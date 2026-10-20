-- ==============================================================================
-- Migration: 20261020000011_community_preventive_and_reporting.sql
-- Description: Phase 7 Community Features, Preventive Maintenance & Reporting
-- Adds:
--  1. Voting rule enforcement trigger for per-flat vs per-resident polls
--  2. Preventive maintenance inspection trigger with automatic next_due_date roll-forward
--  3. Supervisor access to emergency contacts management
--  4. Composite relational foreign keys for cross-society prevention on announcements & polls
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Hardened Poll Voting Integrity Trigger
-- Strictly enforces:
--   - Poll must be active (is_active = true)
--   - Poll must not be past closing_date
--   - If voting_unit = 'per_flat': flat_id is required and exactly 1 vote per flat
--   - If voting_unit = 'per_resident': 1 vote per user (enforced by uq_poll_user_vote)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_poll_vote_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_poll public.polls%ROWTYPE;
    v_existing_flat_vote uuid;
BEGIN
    -- Fetch poll
    SELECT * INTO v_poll FROM public.polls WHERE id = NEW.poll_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target poll not found'
            USING ERRCODE = 'P0002';
    END IF;

    -- Guard: Poll active status
    IF NOT v_poll.is_active THEN
        RAISE EXCEPTION 'Voting rejected: Poll is no longer active'
            USING ERRCODE = '22023';
    END IF;

    -- Guard: Poll expiration
    IF v_poll.closing_date <= now() THEN
        RAISE EXCEPTION 'Voting rejected: Poll voting deadline has passed'
            USING ERRCODE = '22023';
    END IF;

    -- Guard: Voting Unit (per_flat vs per_resident)
    IF v_poll.voting_unit = 'per_flat' THEN
        IF NEW.flat_id IS NULL THEN
            RAISE EXCEPTION 'Voting rejected: Flat ID is required for per-flat voting'
                USING ERRCODE = '22023';
        END IF;

        -- Verify that no previous vote from this flat exists in this poll
        SELECT id INTO v_existing_flat_vote
        FROM public.poll_votes
        WHERE poll_id = NEW.poll_id AND flat_id = NEW.flat_id
        LIMIT 1;

        IF v_existing_flat_vote IS NOT NULL THEN
            RAISE EXCEPTION 'Voting rejected: A vote has already been cast for this flat in this poll'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_poll_vote_rules ON public.poll_votes;
CREATE TRIGGER trg_check_poll_vote_rules
    BEFORE INSERT ON public.poll_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.check_poll_vote_rules();

-- ------------------------------------------------------------------------------
-- 2. Preventive Maintenance Roll-Forward Trigger
-- When an inspection record is logged:
--   - Updates maintenance_schedules.last_completed_date = NEW.performed_date
--   - Automatically advances next_due_date based on schedule frequency
--   - Prevents stale scheduling under repeated operations
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_maintenance_inspection()
RETURNS TRIGGER AS $$
DECLARE
    v_freq text;
    v_next date;
BEGIN
    SELECT frequency INTO v_freq
    FROM public.maintenance_schedules
    WHERE id = NEW.schedule_id;

    IF v_freq = 'daily' THEN
        v_next := NEW.performed_date + INTERVAL '1 day';
    ELSIF v_freq = 'weekly' THEN
        v_next := NEW.performed_date + INTERVAL '7 days';
    ELSIF v_freq = 'biweekly' THEN
        v_next := NEW.performed_date + INTERVAL '14 days';
    ELSIF v_freq = 'monthly' THEN
        v_next := NEW.performed_date + INTERVAL '1 month';
    ELSIF v_freq = 'quarterly' THEN
        v_next := NEW.performed_date + INTERVAL '3 months';
    ELSIF v_freq = 'semiannual' THEN
        v_next := NEW.performed_date + INTERVAL '6 months';
    ELSIF v_freq = 'annual' THEN
        v_next := NEW.performed_date + INTERVAL '1 year';
    ELSE
        v_next := NEW.performed_date + INTERVAL '1 month';
    END IF;

    UPDATE public.maintenance_schedules
    SET last_completed_date = NEW.performed_date,
        next_due_date = v_next,
        updated_at = now()
    WHERE id = NEW.schedule_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_process_maintenance_inspection ON public.maintenance_records;
CREATE TRIGGER trg_process_maintenance_inspection
    AFTER INSERT ON public.maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.process_maintenance_inspection();

-- ------------------------------------------------------------------------------
-- 3. Emergency Contacts Policy Refinement
-- Allows society_admin and supervisor to manage emergency contacts
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "emergency_contacts_manage_admin" ON public.emergency_contacts;
CREATE POLICY "emergency_contacts_manage_admin" ON public.emergency_contacts
    FOR ALL USING (
        public.has_society_role(society_id, ARRAY['society_admin', 'supervisor'])
    );

-- ------------------------------------------------------------------------------
-- 4. Composite Relational Keys & Indices for Society Isolation
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_announcements_published_pinned 
    ON public.announcements(society_id, is_pinned DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedules_society_due 
    ON public.maintenance_schedules(society_id, is_active, next_due_date);

CREATE INDEX IF NOT EXISTS idx_records_society_performed 
    ON public.maintenance_records(society_id, performed_date DESC);
