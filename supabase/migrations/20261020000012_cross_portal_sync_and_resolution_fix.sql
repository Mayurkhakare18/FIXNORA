-- ==============================================================================
-- SmartResolve: Migration 12 — Cross-Portal Synchronization & Resolution RLS Refinement
-- ==============================================================================

-- 1. Refine complaints_update RLS policy
DROP POLICY IF EXISTS "complaints_update" ON public.complaints;

CREATE POLICY "complaints_update" ON public.complaints
FOR UPDATE USING (
    -- Society administrators and supervisors can update any complaint in their society
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    -- Citizen can update their complaint while pending, under review, reopened, or when verifying resolution
    OR (
        citizen_id = public.auth_user_id()
        AND status IN ('submitted', 'awaiting_citizen_response', 'reopened', 'resolved')
    )
    -- In-house maintenance technicians can update complaints they are assigned to
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND public.is_assigned_to_complaint(complaints.id, public.auth_user_id())
    )
)
WITH CHECK (
    -- Citizen can update details, or confirm closure, or reopen
    (
        citizen_id = public.auth_user_id()
        AND society_id = complaints.society_id
        AND status IN ('submitted', 'awaiting_citizen_response', 'reopened', 'closed')
    )
    -- Maintenance staff can update in-progress or mark resolved
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND society_id = complaints.society_id
        AND citizen_id = complaints.citizen_id
        AND public.is_assigned_to_complaint(complaints.id, public.auth_user_id())
    )
    -- Society administrators and supervisors
    OR (
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
        AND society_id = complaints.society_id
        AND citizen_id = complaints.citizen_id
    )
);

-- 2. Add Notifications Insert Policy
DROP POLICY IF EXISTS "notifications_insert_member" ON public.notifications;

CREATE POLICY "notifications_insert_member" ON public.notifications
FOR INSERT WITH CHECK (
    public.is_society_member(society_id)
);

-- 3. Notify schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
