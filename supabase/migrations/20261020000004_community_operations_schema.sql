-- ==============================================================================
-- Migration: 20261020000004_community_operations_schema.sql
-- Description: Tables 18 to 27: Notifications, Announcements, Polls, Feedback, Expenses, Emergency Contacts, Audit Logs
-- ==============================================================================

-- 18. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
    title text NOT NULL,
    message text NOT NULL,
    notification_type text NOT NULL CHECK (notification_type IN (
        'complaint_submitted',
        'assigned',
        'status_changed',
        'escalated',
        'resolved',
        'announcement',
        'poll_published',
        'emergency_alert'
    )),
    channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
    is_read boolean NOT NULL DEFAULT false,
    delivered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_society_id ON public.notifications(society_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(recipient_id, is_read);

-- 19. Announcements Table (Society Broadcasts & Circulars)
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'maintenance', 'emergency', 'event', 'billing')),
    is_pinned boolean NOT NULL DEFAULT false,
    published_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_society_id ON public.announcements(society_id);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.announcements(category);

CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 20. Polls Table (Resident Voting & Feedback on Community Decisions)
CREATE TABLE IF NOT EXISTS public.polls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    question text NOT NULL,
    description text,
    closing_date timestamptz NOT NULL,
    voting_unit text NOT NULL DEFAULT 'per_flat' CHECK (voting_unit IN ('per_flat', 'per_resident')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_society_id ON public.polls(society_id);
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON public.polls(is_active);

CREATE TRIGGER trg_polls_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 21. Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options(poll_id);

-- 22. Poll Votes Table (Enforces 1 vote per member or 1 vote per flat)
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    flat_id uuid REFERENCES public.flats(id) ON DELETE SET NULL,
    voted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_poll_user_vote UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes(option_id);

-- 23. Complaint Feedback Table (Post-Resolution Resident Rating & Review)
CREATE TABLE IF NOT EXISTS public.complaint_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
    citizen_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    satisfaction_level text NOT NULL CHECK (satisfaction_level IN ('very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied')),
    feedback_text text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_complaint_id ON public.complaint_feedback(complaint_id);

-- 24. Expenses Table (Society Maintenance & Operations - NO VENDOR DEPENDENCY)
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
    recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category text NOT NULL CHECK (category IN (
        'electrical_parts',
        'plumbing_parts',
        'lift_servicing',
        'generator_diesel',
        'cleaning_materials',
        'security_equipment',
        'civil_repairs',
        'general_maintenance'
    )),
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    description text NOT NULL,
    approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_society_id ON public.expenses(society_id);
CREATE INDEX IF NOT EXISTS idx_expenses_complaint_id ON public.expenses(complaint_id);
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status ON public.expenses(approval_status);

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 25. Expense Receipts Table (Invoices and Supporting Documents)
CREATE TABLE IF NOT EXISTS public.expense_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
    content_type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_expense_id ON public.expense_receipts(expense_id);

-- 26. Emergency Contacts Table (Important Society Phone Numbers)
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    title text NOT NULL,
    contact_person text,
    phone_number text NOT NULL,
    alternative_phone text,
    available_hours text NOT NULL DEFAULT '24/7',
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_society_id ON public.emergency_contacts(society_id);

-- 27. Audit Logs Table (Tamper-Proof Platform Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid REFERENCES public.societies(id) ON DELETE SET NULL,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_society_id ON public.audit_logs(society_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
