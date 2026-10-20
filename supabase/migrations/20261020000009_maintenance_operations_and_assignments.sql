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
-- 2. Enhance assignments_select Policy: Resident Visibility for Own Complaints
-- ------------------------------------------------------------------------------
-- Allows the complaint author (resident) to view the assignment record of their own complaint,
-- in addition to the assigned technician and society administrators/supervisors.
DROP POLICY IF EXISTS "assignments_select" ON public.complaint_assignments;

CREATE POLICY "assignments_select" ON public.complaint_assignments
FOR SELECT TO authenticated
USING (
    assigned_to_user_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_assignments.complaint_id
          AND c.citizen_id = public.auth_user_id()
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
