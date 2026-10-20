-- ==============================================================================
-- Migration: 20261020000009_maintenance_operations_and_assignments.sql
-- Description: Phase 5: In-House Maintenance Operations and Staff Assignment
-- Partial unique index on active assignments, resident assignment visibility,
-- maintenance jobs update hardening, and eligible staff query helper
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Partial Unique Index: Prevent Duplicate Active Assignments
-- ------------------------------------------------------------------------------
-- Ensures a complaint can have at most one active ('assigned', 'accepted', 'in_progress') assignment
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_complaint_assignment 
ON public.complaint_assignments (complaint_id) 
WHERE status IN ('assigned', 'accepted', 'in_progress');

-- ------------------------------------------------------------------------------
-- 2. Security Helpers to Break Mutual RLS Recursion between Complaints & Assignments
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_assigned_to_complaint(p_complaint_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
    IF p_complaint_id IS NULL OR p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.complaint_assignments
        WHERE complaint_id = p_complaint_id AND assigned_to_user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_assigned_to_complaint(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_complaint(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_complaint_complainant(p_complaint_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
    IF p_complaint_id IS NULL OR p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.complaints
        WHERE id = p_complaint_id AND citizen_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_complaint_complainant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_complaint_complainant(uuid, uuid) TO authenticated;

-- Enhance assignments_select Policy: Resident Visibility for Own Complaints
DROP POLICY IF EXISTS "assignments_select" ON public.complaint_assignments;

CREATE POLICY "assignments_select" ON public.complaint_assignments
FOR SELECT TO authenticated
USING (
    assigned_to_user_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR public.is_complaint_complainant(complaint_assignments.complaint_id, public.auth_user_id())
);

-- Update complaints_select to use is_assigned_to_complaint helper
DROP POLICY IF EXISTS "complaints_select" ON public.complaints;

CREATE POLICY "complaints_select" ON public.complaints
FOR SELECT USING (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND (
            public.is_assigned_to_complaint(complaints.id, public.auth_user_id())
            OR department_id IN (
                SELECT d.id FROM public.departments d
                JOIN public.society_memberships sm ON sm.society_id = d.society_id
                WHERE sm.user_id = public.auth_user_id()
            )
        )
    )
    OR (
        public.has_society_role(society_id, ARRAY['resident'])
        AND (
            citizen_id = public.auth_user_id()
            OR (is_anonymous = false)
        )
    )
);

-- ------------------------------------------------------------------------------
-- 3. Harden maintenance_jobs_update Policy
-- ------------------------------------------------------------------------------
-- Restricts staff from tampering with society association or transferring assigned_staff_id
DROP POLICY IF EXISTS "maintenance_jobs_update" ON public.maintenance_jobs;

CREATE POLICY "maintenance_jobs_update" ON public.maintenance_jobs
FOR UPDATE TO authenticated
USING (
    assigned_staff_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
)
WITH CHECK (
    society_id = maintenance_jobs.society_id
    AND (
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
        OR assigned_staff_id = maintenance_jobs.assigned_staff_id
    )
);

-- ------------------------------------------------------------------------------
-- 4. Eligible Staff Directory Helper for Authorized Admins & Supervisors
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_eligible_society_staff(p_society_id uuid)
RETURNS TABLE (
    membership_id uuid,
    user_id uuid,
    full_name text,
    email text,
    role text,
    staff_designation text,
    department_id uuid
) AS $$
BEGIN
    -- Verify caller is authorized as admin or supervisor for this society
    IF NOT public.has_society_role(p_society_id, ARRAY['society_admin', 'supervisor']) THEN
        RAISE EXCEPTION 'Access denied: caller is not an administrator or supervisor for society %', p_society_id;
    END IF;

    RETURN QUERY
    SELECT 
        sm.id AS membership_id,
        sm.user_id,
        p.full_name,
        p.email,
        sm.role::text,
        sm.staff_designation,
        d.id AS department_id
    FROM public.society_memberships sm
    JOIN public.profiles p ON p.id = sm.user_id
    LEFT JOIN public.departments d ON d.society_id = sm.society_id AND d.head_officer_id = sm.user_id
    WHERE sm.society_id = p_society_id
      AND sm.status = 'active'
      AND sm.role IN ('maintenance_staff', 'supervisor')
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_eligible_society_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_eligible_society_staff(uuid) TO authenticated;
