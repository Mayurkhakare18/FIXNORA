-- ==============================================================================
-- Migration: 20261020000007_rls_refinements.sql
-- Description: Phase 2.2 Security Refinements, RLS Hardening, and Cross-Society Relational Integrity
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Co-Member Profile Visibility Helper
-- ------------------------------------------------------------------------------
-- Secure helper function to check if target user shares an active society membership
-- with the requesting user. Uses SECURITY DEFINER with explicit search_path to bypass
-- recursive RLS on society_memberships while preventing profile enumeration.
CREATE OR REPLACE FUNCTION public.shares_society_with(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
    IF auth.uid() IS NULL OR target_user_id IS NULL THEN
        RETURN false;
    END IF;

    IF target_user_id = auth.uid() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.society_memberships sm1
        JOIN public.society_memberships sm2 ON sm1.society_id = sm2.society_id
        WHERE sm1.user_id = auth.uid()
          AND sm2.user_id = target_user_id
          AND sm1.status = 'active'
          AND sm2.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.shares_society_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_society_with(uuid) TO authenticated;

-- Replace profiles_select_own policy with secure helper call
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (
    id = public.auth_user_id()
    OR public.is_platform_admin()
    OR public.shares_society_with(id)
);

-- ------------------------------------------------------------------------------
-- 2. Administrative Staff Enrollment Policy
-- ------------------------------------------------------------------------------
-- Permits authorized society administrators to enroll in-house maintenance staff,
-- supervisors, and approved residents. Strictly blocks granting society_admin role
-- via this endpoint and prevents elevation to platform administrator.
CREATE POLICY "memberships_insert_admin" ON public.society_memberships
FOR INSERT WITH CHECK (
    public.has_society_role(society_id, ARRAY['society_admin'])
    AND role IN ('resident', 'maintenance_staff', 'supervisor')
    AND status IN ('pending', 'active')
);

-- ------------------------------------------------------------------------------
-- 3. Complaint Update Protection & Field Immutability
-- ------------------------------------------------------------------------------
-- Defense-in-depth trigger: blocks any attempt to transfer complaint between societies,
-- reassign the complainant, or alter the tracking ID
CREATE OR REPLACE FUNCTION public.check_complaint_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.society_id <> OLD.society_id THEN
        RAISE EXCEPTION 'Cannot transfer complaints across societies (society_id is immutable)';
    END IF;
    IF NEW.citizen_id <> OLD.citizen_id THEN
        RAISE EXCEPTION 'Cannot change original complainant (citizen_id is immutable)';
    END IF;
    IF NEW.tracking_id <> OLD.tracking_id THEN
        RAISE EXCEPTION 'Tracking ID is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_immutable_fields ON public.complaints;

CREATE TRIGGER trg_complaints_immutable_fields
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.check_complaint_immutable_fields();

-- Drop and replace complaints_update with explicit WITH CHECK validation
DROP POLICY IF EXISTS "complaints_update" ON public.complaints;

CREATE POLICY "complaints_update" ON public.complaints
FOR UPDATE USING (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR (
        citizen_id = public.auth_user_id()
        AND status IN ('submitted', 'awaiting_citizen_response', 'reopened')
    )
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND EXISTS (
            SELECT 1 FROM public.complaint_assignments ca
            WHERE ca.complaint_id = complaints.id
              AND ca.assigned_to_user_id = public.auth_user_id()
        )
    )
)
WITH CHECK (
    (
        citizen_id = public.auth_user_id()
        AND society_id = complaints.society_id
        AND status IN ('submitted', 'awaiting_citizen_response', 'reopened')
    )
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND society_id = complaints.society_id
        AND citizen_id = complaints.citizen_id
        AND EXISTS (
            SELECT 1 FROM public.complaint_assignments ca
            WHERE ca.complaint_id = complaints.id
              AND ca.assigned_to_user_id = public.auth_user_id()
        )
    )
    OR (
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
        AND society_id = complaints.society_id
        AND citizen_id = complaints.citizen_id
    )
);

-- ------------------------------------------------------------------------------
-- 4. Automated Status-Transition Attribution
-- ------------------------------------------------------------------------------
-- Make actor_id nullable in complaint_status_history so system-triggered updates
-- are not falsely attributed to the citizen
ALTER TABLE public.complaint_status_history
ALTER COLUMN actor_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_complaint_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id uuid;
    v_remarks text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_actor_id := auth.uid();
        INSERT INTO public.complaint_status_history (
            complaint_id,
            society_id,
            actor_id,
            previous_status,
            new_status,
            remarks
        ) VALUES (
            NEW.id,
            NEW.society_id,
            COALESCE(v_actor_id, NEW.citizen_id),
            NULL,
            NEW.status,
            'Initial complaint submission'
        );
    ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        IF auth.uid() IS NOT NULL THEN
            v_actor_id := auth.uid();
            v_remarks := COALESCE(NEW.resolution_remarks, 'Status updated to ' || NEW.status);
        ELSE
            -- Automated background/system process (e.g. SLA monitor or service role):
            -- Never attribute to the citizen!
            v_actor_id := NULL;
            v_remarks := COALESCE(NEW.resolution_remarks, 'Automated system transition to ' || NEW.status);
        END IF;

        INSERT INTO public.complaint_status_history (
            complaint_id,
            society_id,
            actor_id,
            previous_status,
            new_status,
            remarks
        ) VALUES (
            NEW.id,
            NEW.society_id,
            v_actor_id,
            OLD.status,
            NEW.status,
            v_remarks
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 5. Relational Integrity: Composite Unique & Foreign Key Constraints
-- ------------------------------------------------------------------------------

-- A. Buildings <-> Flats (prevents assigning flat to building of different society)
ALTER TABLE public.buildings
ADD CONSTRAINT uq_buildings_id_society UNIQUE (id, society_id);

ALTER TABLE public.flats
ADD CONSTRAINT fk_flats_building_society
FOREIGN KEY (building_id, society_id) REFERENCES public.buildings(id, society_id) ON DELETE CASCADE;

-- B. Departments <-> Complaint Categories
ALTER TABLE public.departments
ADD CONSTRAINT uq_departments_id_society UNIQUE (id, society_id);

ALTER TABLE public.complaint_categories
ADD CONSTRAINT fk_categories_department_society
FOREIGN KEY (department_id, society_id) REFERENCES public.departments(id, society_id) ON DELETE CASCADE;

-- C. Complaints <-> Sub-Entities (Assignments, Attachments, Comments, Status History, Verifications)
ALTER TABLE public.complaints
ADD CONSTRAINT uq_complaints_id_society UNIQUE (id, society_id);

ALTER TABLE public.complaint_assignments
ADD CONSTRAINT fk_assignments_complaint_society
FOREIGN KEY (complaint_id, society_id) REFERENCES public.complaints(id, society_id) ON DELETE CASCADE;

ALTER TABLE public.complaint_attachments
ADD CONSTRAINT fk_attachments_complaint_society
FOREIGN KEY (complaint_id, society_id) REFERENCES public.complaints(id, society_id) ON DELETE CASCADE;

ALTER TABLE public.complaint_comments
ADD CONSTRAINT fk_comments_complaint_society
FOREIGN KEY (complaint_id, society_id) REFERENCES public.complaints(id, society_id) ON DELETE CASCADE;

ALTER TABLE public.complaint_status_history
ADD CONSTRAINT fk_status_history_complaint_society
FOREIGN KEY (complaint_id, society_id) REFERENCES public.complaints(id, society_id) ON DELETE CASCADE;

ALTER TABLE public.resolution_verifications
ADD CONSTRAINT fk_verifications_complaint_society
FOREIGN KEY (complaint_id, society_id) REFERENCES public.complaints(id, society_id) ON DELETE CASCADE;

-- D. Maintenance Schedules <-> Records
ALTER TABLE public.maintenance_schedules
ADD CONSTRAINT uq_schedules_id_society UNIQUE (id, society_id);

ALTER TABLE public.maintenance_records
ADD CONSTRAINT fk_records_schedule_society
FOREIGN KEY (schedule_id, society_id) REFERENCES public.maintenance_schedules(id, society_id) ON DELETE CASCADE;

-- E. Complaints cross-references to Building and Category
ALTER TABLE public.complaint_categories
ADD CONSTRAINT uq_categories_id_society UNIQUE (id, society_id);

ALTER TABLE public.complaints
ADD CONSTRAINT fk_complaints_building_society
FOREIGN KEY (building_id, society_id) REFERENCES public.buildings(id, society_id) ON DELETE SET NULL;

ALTER TABLE public.complaints
ADD CONSTRAINT fk_complaints_category_society
FOREIGN KEY (category_id, society_id) REFERENCES public.complaint_categories(id, society_id) ON DELETE RESTRICT;

-- ==============================================================================
-- ROLLBACK SPECIFICATION (Reference Documentation)
-- ==============================================================================
/*
To roll back Migration 20261020000007:
1. Drop composite constraints:
   ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS fk_complaints_category_society;
   ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS fk_complaints_building_society;
   ALTER TABLE public.complaint_categories DROP CONSTRAINT IF EXISTS uq_categories_id_society;
   ALTER TABLE public.maintenance_records DROP CONSTRAINT IF EXISTS fk_records_schedule_society;
   ALTER TABLE public.maintenance_schedules DROP CONSTRAINT IF EXISTS uq_schedules_id_society;
   ALTER TABLE public.resolution_verifications DROP CONSTRAINT IF EXISTS fk_verifications_complaint_society;
   ALTER TABLE public.complaint_status_history DROP CONSTRAINT IF EXISTS fk_status_history_complaint_society;
   ALTER TABLE public.complaint_comments DROP CONSTRAINT IF EXISTS fk_comments_complaint_society;
   ALTER TABLE public.complaint_attachments DROP CONSTRAINT IF EXISTS fk_attachments_complaint_society;
   ALTER TABLE public.complaint_assignments DROP CONSTRAINT IF EXISTS fk_assignments_complaint_society;
   ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS uq_complaints_id_society;
   ALTER TABLE public.complaint_categories DROP CONSTRAINT IF EXISTS fk_categories_department_society;
   ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS uq_departments_id_society;
   ALTER TABLE public.flats DROP CONSTRAINT IF EXISTS fk_flats_building_society;
   ALTER TABLE public.buildings DROP CONSTRAINT IF EXISTS uq_buildings_id_society;

2. Restore status-transition trigger from migration 6:
   (re-execute log_complaint_status_transition definition from 20261020000006)
   ALTER TABLE public.complaint_status_history ALTER COLUMN actor_id SET NOT NULL;

3. Restore complaints_update policy from migration 5:
   DROP TRIGGER IF EXISTS trg_complaints_immutable_fields ON public.complaints;
   DROP FUNCTION IF EXISTS public.check_complaint_immutable_fields();
   DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
   (re-create complaints_update from 20261020000005)

4. Drop admin membership policy:
   DROP POLICY IF EXISTS "memberships_insert_admin" ON public.society_memberships;

5. Restore profiles policy:
   DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
   (re-create profiles_select_own from 20261020000005)
   DROP FUNCTION IF EXISTS public.shares_society_with(uuid);
*/
