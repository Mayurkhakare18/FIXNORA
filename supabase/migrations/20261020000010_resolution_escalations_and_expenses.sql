-- ==============================================================================
-- Migration: 20261020000010_resolution_escalations_and_expenses.sql
-- Description: Phase 6: Resolution Verification, SLA Escalations, Feedback and Expenses
--   1. SLA target auto-calculation trigger based on category SLA hours and priority
--   2. Complaint escalation idempotency constraint uq_complaint_escalation_level
--   3. Hardened resolution verification and resident feedback RLS policies
--   4. Private storage bucket 'expense-receipts' and storage RLS policies
--   5. Enhanced expense receipts schema and society-scoped expense policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SLA Target Auto-Calculation Trigger on Complaints
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_complaint_sla_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_base_sla_hours integer;
    v_effective_hours integer;
BEGIN
    -- Only calculate if sla_target_at is not manually provided
    IF NEW.sla_target_at IS NULL THEN
        -- Fetch base sla_hours from category
        SELECT sla_hours INTO v_base_sla_hours
        FROM public.complaint_categories
        WHERE id = NEW.category_id;

        IF v_base_sla_hours IS NULL OR v_base_sla_hours <= 0 THEN
            v_base_sla_hours := 48; -- Default fallback
        END IF;

        -- Apply priority multiplier
        CASE NEW.priority
            WHEN 'urgent' THEN
                v_effective_hours := GREATEST(2, ROUND(v_base_sla_hours * 0.25)::integer);
            WHEN 'high' THEN
                v_effective_hours := GREATEST(4, ROUND(v_base_sla_hours * 0.50)::integer);
            WHEN 'medium' THEN
                v_effective_hours := v_base_sla_hours;
            WHEN 'low' THEN
                v_effective_hours := ROUND(v_base_sla_hours * 1.50)::integer;
            ELSE
                v_effective_hours := v_base_sla_hours;
        END CASE;

        NEW.sla_target_at := COALESCE(NEW.submitted_at, now()) + (v_effective_hours || ' hours')::interval;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_complaint_sla_target ON public.complaints;
CREATE TRIGGER trg_set_complaint_sla_target
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.calculate_complaint_sla_target();

-- ------------------------------------------------------------------------------
-- 2. Complaint Escalation Idempotency Constraint
-- ------------------------------------------------------------------------------
-- Ensure that the same escalation level cannot be recorded more than once for a complaint
CREATE UNIQUE INDEX IF NOT EXISTS uq_complaint_escalation_level
ON public.complaint_escalations (complaint_id, escalation_level);

-- ------------------------------------------------------------------------------
-- 3. Hardened Resolution Verification RLS Policies
-- ------------------------------------------------------------------------------
-- Enforce that ONLY the actual complainant (citizen_id) can verify the complaint,
-- and ONLY when the complaint status is 'resolved'.
-- Staff and administrators cannot submit resident verifications.
DROP POLICY IF EXISTS "verifications_insert" ON public.resolution_verifications;
CREATE POLICY "verifications_insert" ON public.resolution_verifications
FOR INSERT WITH CHECK (
    verified_by = public.auth_user_id()
    AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_id
          AND c.citizen_id = public.auth_user_id()
          AND c.society_id = resolution_verifications.society_id
          AND c.status = 'resolved'
    )
);

-- Ensure only one positive closure verification per complaint
CREATE UNIQUE INDEX IF NOT EXISTS uq_resolution_satisfied_verification
ON public.resolution_verifications (complaint_id)
WHERE is_satisfied = true;

-- Hardened complaint feedback insert policy:
-- Resident can only submit feedback for their own complaint when resolved or closed.
DROP POLICY IF EXISTS "feedback_insert_citizen" ON public.complaint_feedback;
CREATE POLICY "feedback_insert_citizen" ON public.complaint_feedback
FOR INSERT WITH CHECK (
    citizen_id = public.auth_user_id()
    AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_feedback.complaint_id
          AND c.citizen_id = public.auth_user_id()
          AND c.status IN ('resolved', 'closed')
    )
);

-- ------------------------------------------------------------------------------
-- 4. Enhance Expense Receipts Schema
-- ------------------------------------------------------------------------------
-- Add society_id and uploaded_by to expense_receipts for tenant isolation and auditability
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'expense_receipts' AND column_name = 'society_id'
    ) THEN
        ALTER TABLE public.expense_receipts
        ADD COLUMN society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'expense_receipts' AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE public.expense_receipts
        ADD COLUMN uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expense_receipts_society_id ON public.expense_receipts(society_id);

-- ------------------------------------------------------------------------------
-- 5. Private Storage Bucket for Expense Receipts
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'expense-receipts',
            'expense-receipts',
            false,
            10485760, -- 10MB maximum file size
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 10485760,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    END IF;
END $$;

-- Storage Objects RLS for 'expense-receipts'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        DROP POLICY IF EXISTS "receipts_select_society_admin_supervisor" ON storage.objects;
        DROP POLICY IF EXISTS "receipts_insert_authorized_staff" ON storage.objects;
        DROP POLICY IF EXISTS "receipts_delete_society_admin" ON storage.objects;

        -- 1. SELECT: Only Society Admins and Supervisors in the matching society
        -- Residents are explicitly excluded from viewing private receipts
        CREATE POLICY "receipts_select_society_admin_supervisor" ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'expense-receipts'
            AND (
                public.is_platform_admin()
                OR (
                    split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
                    AND public.has_society_role(
                        split_part(name, '/', 1)::uuid,
                        ARRAY['society_admin', 'supervisor']
                    )
                )
            )
        );

        -- 2. INSERT: Admins, Supervisors, and Maintenance Staff recording job materials
        CREATE POLICY "receipts_insert_authorized_staff" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'expense-receipts'
            AND (
                public.is_platform_admin()
                OR (
                    split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
                    AND public.has_society_role(
                        split_part(name, '/', 1)::uuid,
                        ARRAY['society_admin', 'supervisor', 'maintenance_staff']
                    )
                )
            )
        );

        -- 3. DELETE: Only Society Admins can remove receipts
        CREATE POLICY "receipts_delete_society_admin" ON storage.objects
        FOR DELETE TO authenticated
        USING (
            bucket_id = 'expense-receipts'
            AND (
                public.is_platform_admin()
                OR (
                    split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
                    AND public.has_society_role(
                        split_part(name, '/', 1)::uuid,
                        ARRAY['society_admin']
                    )
                )
            )
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. Hardened Expense Management RLS Policies
-- ------------------------------------------------------------------------------
-- Ensure society admin can delete expenses (e.g. erroneous entries)
DROP POLICY IF EXISTS "expenses_delete_admin" ON public.expenses;
CREATE POLICY "expenses_delete_admin" ON public.expenses
FOR DELETE USING (
    public.has_society_role(society_id, ARRAY['society_admin'])
);

-- Ensure staff can only record material expenses that correlate with their active jobs
-- and cannot view other society financial records.
-- (The existing expenses_select already enforces this: staff only see recorded_by = auth.uid())

-- Ensure expense receipt table enforces society admin/supervisor visibility
DROP POLICY IF EXISTS "expense_receipts_select" ON public.expense_receipts;
CREATE POLICY "expense_receipts_select" ON public.expense_receipts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = expense_receipts.expense_id
          AND (
              public.has_society_role(e.society_id, ARRAY['society_admin', 'supervisor'])
              OR (public.has_society_role(e.society_id, ARRAY['maintenance_staff']) AND e.recorded_by = public.auth_user_id())
          )
    )
);
