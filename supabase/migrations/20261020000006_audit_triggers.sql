-- ==============================================================================
-- Migration: 20261020000006_audit_triggers.sql
-- Description: Tracking ID generator, audit log engine triggers, and automated status transition tracking
-- ==============================================================================

-- 1. Tracking ID Generator Sequence & Function
CREATE SEQUENCE IF NOT EXISTS public.complaint_tracking_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_complaint_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
    current_year text;
    next_val text;
BEGIN
    IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
        current_year := TO_CHAR(NOW(), 'YYYY');
        next_val := LPAD(NEXTVAL('public.complaint_tracking_seq')::text, 4, '0');
        NEW.tracking_id := 'SR-' || current_year || '-' || next_val;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_complaint_tracking_id
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.generate_complaint_tracking_id();

-- 2. Automated Complaint Status History Logging Trigger
CREATE OR REPLACE FUNCTION public.log_complaint_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
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
            COALESCE(auth.uid(), NEW.citizen_id),
            NULL,
            NEW.status,
            'Initial complaint submission'
        );
    ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
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
            COALESCE(auth.uid(), NEW.citizen_id),
            OLD.status,
            NEW.status,
            COALESCE(NEW.resolution_remarks, 'Status updated to ' || NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_complaint_status_transition
AFTER INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.log_complaint_status_transition();

-- 3. Generic Audit Logger Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    soc_id uuid;
    rec_id uuid;
BEGIN
    -- Extract society_id safely if present
    IF TG_OP = 'DELETE' THEN
        rec_id := OLD.id;
        BEGIN
            soc_id := OLD.society_id;
        EXCEPTION WHEN OTHERS THEN
            soc_id := NULL;
        END;

        INSERT INTO public.audit_logs (
            society_id,
            actor_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        ) VALUES (
            soc_id,
            auth.uid(),
            TG_OP,
            TG_TABLE_NAME,
            rec_id,
            to_jsonb(OLD),
            NULL
        );
        RETURN OLD;
    ELSE
        rec_id := NEW.id;
        BEGIN
            soc_id := NEW.society_id;
        EXCEPTION WHEN OTHERS THEN
            soc_id := NULL;
        END;

        INSERT INTO public.audit_logs (
            society_id,
            actor_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        ) VALUES (
            soc_id,
            auth.uid(),
            TG_OP,
            TG_TABLE_NAME,
            rec_id,
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Attach Audit Triggers to Core Transaction Tables
CREATE TRIGGER trg_audit_complaints
AFTER INSERT OR UPDATE OR DELETE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

CREATE TRIGGER trg_audit_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.complaint_assignments
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

CREATE TRIGGER trg_audit_maintenance_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_jobs
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

CREATE TRIGGER trg_audit_verifications
AFTER INSERT OR UPDATE OR DELETE ON public.resolution_verifications
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

CREATE TRIGGER trg_audit_memberships
AFTER INSERT OR UPDATE OR DELETE ON public.society_memberships
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
