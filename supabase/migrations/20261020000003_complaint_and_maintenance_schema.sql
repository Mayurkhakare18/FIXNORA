-- ==============================================================================
-- Migration: 20261020000003_complaint_and_maintenance_schema.sql
-- Description: Tables 8 to 17: Complaints, Attachments, In-House Assignments, Jobs, Schedules, History, Comments, Escalations, Verifications
-- ==============================================================================

-- 8. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    tracking_id text NOT NULL UNIQUE,
    citizen_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
    flat_id uuid REFERENCES public.flats(id) ON DELETE SET NULL,
    category_id uuid NOT NULL REFERENCES public.complaint_categories(id) ON DELETE RESTRICT,
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text NOT NULL,
    location_details text,
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted',
        'under_review',
        'assigned',
        'in_progress',
        'resolved',
        'closed',
        'awaiting_citizen_response',
        'reopened',
        'rejected'
    )),
    is_anonymous boolean NOT NULL DEFAULT false,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    sla_target_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz,
    resolution_remarks text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_society_id ON public.complaints(society_id);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id ON public.complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_tracking_id ON public.complaints(tracking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_department_id ON public.complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category_id ON public.complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_building_id ON public.complaints(building_id);

CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Complaint Attachments Table
CREATE TABLE IF NOT EXISTS public.complaint_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
    content_type text NOT NULL,
    attachment_type text NOT NULL DEFAULT 'evidence' CHECK (attachment_type IN ('evidence', 'resolution_proof', 'invoice_receipt')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_complaint_id ON public.complaint_attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_attachments_society_id ON public.complaint_attachments(society_id);

-- 10. Complaint Assignments Table (Strictly In-House Maintenance Staff)
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    assigned_to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'rejected', 'in_progress', 'completed', 'reassigned')),
    rejection_reason text,
    reassigned_reason text,
    target_deadline timestamptz,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_complaint_id ON public.complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON public.complaint_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_society_id ON public.complaint_assignments(society_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.complaint_assignments(status);

-- 11. Maintenance Jobs Table (Operational Job Tracking for In-House Staff)
CREATE TABLE IF NOT EXISTS public.maintenance_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
    assigned_staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text,
    job_type text NOT NULL CHECK (job_type IN ('complaint_repair', 'preventive_inspection', 'emergency_repair', 'routine_servicing')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    material_cost numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (material_cost >= 0),
    labor_hours numeric(6,2) NOT NULL DEFAULT 0.00 CHECK (labor_hours >= 0),
    repair_notes text,
    before_photo_url text,
    after_photo_url text,
    scheduled_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_society_id ON public.maintenance_jobs(society_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_assigned_staff ON public.maintenance_jobs(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_complaint_id ON public.maintenance_jobs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_status ON public.maintenance_jobs(status);

CREATE TRIGGER trg_maintenance_jobs_updated_at
BEFORE UPDATE ON public.maintenance_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 12. Maintenance Schedules Table (Preventive Facility Maintenance)
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    facility_name text NOT NULL,
    frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
    assigned_staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    next_due_date date NOT NULL,
    last_completed_date date,
    is_active boolean NOT NULL DEFAULT true,
    checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_society_id ON public.maintenance_schedules(society_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_due ON public.maintenance_schedules(next_due_date);

CREATE TRIGGER trg_maintenance_schedules_updated_at
BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. Maintenance Records Table (Completed Inspection Records)
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    performed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    performed_date date NOT NULL DEFAULT CURRENT_DATE,
    status text NOT NULL CHECK (status IN ('satisfactory', 'needs_repair', 'critical_fault')),
    observations text,
    checklist_results jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_schedule_id ON public.maintenance_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_records_society_id ON public.maintenance_records(society_id);

-- 14. Complaint Status History Table (Immutable Transition History)
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    previous_status text,
    new_status text NOT NULL,
    remarks text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_society_id ON public.complaint_status_history(society_id);

-- 15. Complaint Comments Table (Public Citizen Updates vs Private Internal Notes)
CREATE TABLE IF NOT EXISTS public.complaint_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    comment_text text NOT NULL,
    is_internal boolean NOT NULL DEFAULT false, -- If true: strictly staff/admin only!
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_complaint_id ON public.complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_society_id ON public.complaint_comments(society_id);

-- 16. Complaint Escalations Table
CREATE TABLE IF NOT EXISTS public.complaint_escalations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    escalation_level integer NOT NULL CHECK (escalation_level BETWEEN 1 AND 3),
    trigger_type text NOT NULL CHECK (trigger_type IN ('automated_sla_breach', 'manual_supervisor', 'citizen_appeal')),
    reason text NOT NULL,
    notified_roles text[] NOT NULL,
    escalated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_complaint_id ON public.complaint_escalations(complaint_id);
CREATE INDEX IF NOT EXISTS idx_escalations_society_id ON public.complaint_escalations(society_id);

-- 17. Resolution Verifications Table (Resident Closure Confirmation or Reopen Request)
CREATE TABLE IF NOT EXISTS public.resolution_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    verified_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    is_satisfied boolean NOT NULL,
    verification_notes text,
    verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifications_complaint_id ON public.resolution_verifications(complaint_id);
CREATE INDEX IF NOT EXISTS idx_verifications_society_id ON public.resolution_verifications(society_id);
