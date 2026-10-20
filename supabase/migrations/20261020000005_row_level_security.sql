-- ==============================================================================
-- Migration: 20261020000005_row_level_security.sql
-- Description: Comprehensive Row Level Security (RLS) policies for all 27 tables
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on all 27 Tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Profiles Policies
-- ------------------------------------------------------------------------------
-- Users can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (
    id = public.auth_user_id() 
    OR public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.society_memberships sm1
        JOIN public.society_memberships sm2 ON sm1.society_id = sm2.society_id
        WHERE sm1.user_id = public.auth_user_id() AND sm2.user_id = profiles.id
          AND sm1.status = 'active' AND sm2.status = 'active'
    )
);

-- Users can insert their own profile on registration
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (
    id = public.auth_user_id() 
    AND is_platform_admin = false
);

-- Users can update only their own profile, without elevating admin privileges
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (id = public.auth_user_id())
WITH CHECK (
    id = public.auth_user_id() 
    AND (is_platform_admin = (SELECT is_platform_admin FROM public.profiles WHERE id = public.auth_user_id()))
);

-- ------------------------------------------------------------------------------
-- 3. Societies Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "societies_select_member" ON public.societies
FOR SELECT USING (
    public.is_society_member(id) 
    OR public.is_platform_admin()
);

CREATE POLICY "societies_update_admin" ON public.societies
FOR UPDATE USING (
    public.has_society_role(id, ARRAY['society_admin'])
);

-- ------------------------------------------------------------------------------
-- 4. Buildings & Flats Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "buildings_select_member" ON public.buildings
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "buildings_manage_admin" ON public.buildings
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

CREATE POLICY "flats_select_member" ON public.flats
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "flats_manage_admin" ON public.flats
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

-- ------------------------------------------------------------------------------
-- 5. Society Memberships Policies
-- ------------------------------------------------------------------------------
-- Members can view their own membership or society admins can view all memberships in the society
CREATE POLICY "memberships_select" ON public.society_memberships
FOR SELECT USING (
    user_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

-- Users can request to join as a resident (status must be 'pending' and role 'resident')
CREATE POLICY "memberships_insert_resident" ON public.society_memberships
FOR INSERT WITH CHECK (
    user_id = public.auth_user_id()
    AND status = 'pending'
    AND role = 'resident'
);

-- Society admins can approve or update memberships in their society
CREATE POLICY "memberships_update_admin" ON public.society_memberships
FOR UPDATE USING (
    public.has_society_role(society_id, ARRAY['society_admin'])
);

CREATE POLICY "memberships_delete_admin" ON public.society_memberships
FOR DELETE USING (
    public.has_society_role(society_id, ARRAY['society_admin'])
);

-- ------------------------------------------------------------------------------
-- 6. Departments & Categories Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "departments_select" ON public.departments
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "departments_manage_admin" ON public.departments
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

CREATE POLICY "categories_select" ON public.complaint_categories
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "categories_manage_admin" ON public.complaint_categories
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

-- ------------------------------------------------------------------------------
-- 7. Complaints Policies
-- ------------------------------------------------------------------------------
-- Resident can view their own complaints, or public/non-anonymous complaints in their society.
-- Staff can view assigned or department complaints. Admins can view all.
CREATE POLICY "complaints_select" ON public.complaints
FOR SELECT USING (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND (
            EXISTS (
                SELECT 1 FROM public.complaint_assignments ca
                WHERE ca.complaint_id = complaints.id
                  AND ca.assigned_to_user_id = public.auth_user_id()
            )
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

-- Residents can submit complaints in their society
CREATE POLICY "complaints_insert" ON public.complaints
FOR INSERT WITH CHECK (
    citizen_id = public.auth_user_id()
    AND public.is_society_member(society_id)
);

-- Citizen can update complaint when submitted; Staff can update status; Admin can update all
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
);

-- ------------------------------------------------------------------------------
-- 8. Complaint Attachments Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "attachments_select" ON public.complaint_attachments
FOR SELECT USING (
    public.is_society_member(society_id)
);

CREATE POLICY "attachments_insert" ON public.complaint_attachments
FOR INSERT WITH CHECK (
    uploaded_by = public.auth_user_id()
    AND public.is_society_member(society_id)
);

-- ------------------------------------------------------------------------------
-- 9. Complaint Assignments Policies (Strictly In-House Staff)
-- ------------------------------------------------------------------------------
CREATE POLICY "assignments_select" ON public.complaint_assignments
FOR SELECT USING (
    assigned_to_user_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

CREATE POLICY "assignments_insert_admin" ON public.complaint_assignments
FOR INSERT WITH CHECK (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

CREATE POLICY "assignments_update" ON public.complaint_assignments
FOR UPDATE USING (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR assigned_to_user_id = public.auth_user_id()
);

-- ------------------------------------------------------------------------------
-- 10. Maintenance Jobs Policies (In-House Staff Tasks)
-- ------------------------------------------------------------------------------
CREATE POLICY "maintenance_jobs_select" ON public.maintenance_jobs
FOR SELECT USING (
    assigned_staff_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

CREATE POLICY "maintenance_jobs_insert" ON public.maintenance_jobs
FOR INSERT WITH CHECK (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

CREATE POLICY "maintenance_jobs_update" ON public.maintenance_jobs
FOR UPDATE USING (
    assigned_staff_id = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
);

-- ------------------------------------------------------------------------------
-- 11. Maintenance Schedules & Records Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "schedules_select" ON public.maintenance_schedules
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "schedules_manage_admin" ON public.maintenance_schedules
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin', 'supervisor']));

CREATE POLICY "records_select" ON public.maintenance_records
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "records_insert_staff" ON public.maintenance_records
FOR INSERT WITH CHECK (
    performed_by = public.auth_user_id()
    AND public.has_society_role(society_id, ARRAY['maintenance_staff', 'supervisor', 'society_admin'])
);

-- ------------------------------------------------------------------------------
-- 12. Complaint Status History Policies (Append-only)
-- ------------------------------------------------------------------------------
CREATE POLICY "status_history_select" ON public.complaint_status_history
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "status_history_insert" ON public.complaint_status_history
FOR INSERT WITH CHECK (
    actor_id = public.auth_user_id()
    AND public.is_society_member(society_id)
);

-- ------------------------------------------------------------------------------
-- 13. Complaint Comments Policies (Respects is_internal Privacy)
-- ------------------------------------------------------------------------------
CREATE POLICY "comments_select" ON public.complaint_comments
FOR SELECT USING (
    public.is_society_member(society_id)
    AND (
        is_internal = false
        OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor', 'maintenance_staff'])
    )
);

CREATE POLICY "comments_insert" ON public.complaint_comments
FOR INSERT WITH CHECK (
    author_id = public.auth_user_id()
    AND public.is_society_member(society_id)
    AND (
        is_internal = false
        OR public.has_society_role(society_id, ARRAY['society_admin', 'supervisor', 'maintenance_staff'])
    )
);

-- ------------------------------------------------------------------------------
-- 14. Escalations & Verifications Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "escalations_select" ON public.complaint_escalations
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "verifications_select" ON public.resolution_verifications
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "verifications_insert" ON public.resolution_verifications
FOR INSERT WITH CHECK (
    verified_by = public.auth_user_id()
    AND (
        public.has_society_role(society_id, ARRAY['society_admin'])
        OR EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND c.citizen_id = public.auth_user_id()
        )
    )
);

-- ------------------------------------------------------------------------------
-- 15. Notifications Policies (Strict Recipient Isolation)
-- ------------------------------------------------------------------------------
CREATE POLICY "notifications_select_own" ON public.notifications
FOR SELECT USING (recipient_id = public.auth_user_id());

CREATE POLICY "notifications_update_own" ON public.notifications
FOR UPDATE USING (recipient_id = public.auth_user_id())
WITH CHECK (recipient_id = public.auth_user_id());

-- ------------------------------------------------------------------------------
-- 16. Announcements Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "announcements_select" ON public.announcements
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "announcements_manage_admin" ON public.announcements
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin', 'supervisor']));

-- ------------------------------------------------------------------------------
-- 17. Polls, Options & Votes Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "polls_select" ON public.polls
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "polls_manage_admin" ON public.polls
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

CREATE POLICY "poll_options_select" ON public.poll_options
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.polls p
        WHERE p.id = poll_options.poll_id AND public.is_society_member(p.society_id)
    )
);

CREATE POLICY "poll_options_manage_admin" ON public.poll_options
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.polls p
        WHERE p.id = poll_options.poll_id AND public.has_society_role(p.society_id, ARRAY['society_admin'])
    )
);

CREATE POLICY "poll_votes_select" ON public.poll_votes
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.polls p
        WHERE p.id = poll_votes.poll_id AND public.is_society_member(p.society_id)
    )
);

CREATE POLICY "poll_votes_insert_member" ON public.poll_votes
FOR INSERT WITH CHECK (
    user_id = public.auth_user_id()
    AND EXISTS (
        SELECT 1 FROM public.polls p
        WHERE p.id = poll_votes.poll_id
          AND p.is_active = true
          AND p.closing_date > now()
          AND public.is_society_member(p.society_id)
    )
);

-- ------------------------------------------------------------------------------
-- 18. Complaint Feedback Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "feedback_select" ON public.complaint_feedback
FOR SELECT USING (
    citizen_id = public.auth_user_id()
    OR EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_feedback.complaint_id
          AND public.has_society_role(c.society_id, ARRAY['society_admin', 'supervisor'])
    )
);

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
-- 19. Expenses & Receipts Policies (Society-Scoped Accounting - NO VENDORS)
-- ------------------------------------------------------------------------------
CREATE POLICY "expenses_select" ON public.expenses
FOR SELECT USING (
    public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    OR (
        public.has_society_role(society_id, ARRAY['maintenance_staff'])
        AND recorded_by = public.auth_user_id()
    )
);

CREATE POLICY "expenses_insert" ON public.expenses
FOR INSERT WITH CHECK (
    recorded_by = public.auth_user_id()
    AND public.has_society_role(society_id, ARRAY['society_admin', 'supervisor', 'maintenance_staff'])
);

CREATE POLICY "expenses_update_admin" ON public.expenses
FOR UPDATE USING (
    public.has_society_role(society_id, ARRAY['society_admin'])
);

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

CREATE POLICY "expense_receipts_insert" ON public.expense_receipts
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = expense_receipts.expense_id
          AND public.has_society_role(e.society_id, ARRAY['society_admin', 'supervisor', 'maintenance_staff'])
    )
);

-- ------------------------------------------------------------------------------
-- 20. Emergency Contacts Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "emergency_contacts_select" ON public.emergency_contacts
FOR SELECT USING (public.is_society_member(society_id));

CREATE POLICY "emergency_contacts_manage_admin" ON public.emergency_contacts
FOR ALL USING (public.has_society_role(society_id, ARRAY['society_admin']));

-- ------------------------------------------------------------------------------
-- 21. Audit Logs Policies (Tamper-Proof & Strictly Immutable)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_logs_select" ON public.audit_logs
FOR SELECT USING (
    public.is_platform_admin()
    OR (
        society_id IS NOT NULL 
        AND public.has_society_role(society_id, ARRAY['society_admin'])
    )
);

-- No UPDATE or DELETE policies on audit_logs: Ordinary users CANNOT alter or delete audit history!
