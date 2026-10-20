-- ==============================================================================
-- Migration: 20261020000008_storage_and_complaint_policies.sql
-- Description: Phase 4: Supabase Storage bucket for complaint evidence,
-- Storage RLS policies, attachment cleanup policy, and default society departments/categories seed
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Private Storage Bucket for Complaint Evidence
-- ------------------------------------------------------------------------------
-- Ensure the storage schema and buckets table exist before configuring
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'complaint-evidence',
            'complaint-evidence',
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

-- ------------------------------------------------------------------------------
-- 2. Storage Objects RLS Policies for 'complaint-evidence'
-- ------------------------------------------------------------------------------
-- Enable RLS on storage.objects if not already enabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        -- Drop existing policies if re-running
        DROP POLICY IF EXISTS "evidence_select_authorized_society_members" ON storage.objects;
        DROP POLICY IF EXISTS "evidence_insert_active_society_members" ON storage.objects;
        DROP POLICY IF EXISTS "evidence_delete_uploader_or_admin" ON storage.objects;

        -- 1. SELECT: Only active members of the corresponding society (path: <society_id>/<complaint_id>/<file>)
        CREATE POLICY "evidence_select_authorized_society_members" ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'complaint-evidence'
            AND (
                public.is_platform_admin()
                OR (
                    split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
                    AND public.is_society_member(split_part(name, '/', 1)::uuid)
                )
            )
        );

        -- 2. INSERT: Active society members can upload evidence into their own society folder
        CREATE POLICY "evidence_insert_active_society_members" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'complaint-evidence'
            AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
            AND public.is_society_member(split_part(name, '/', 1)::uuid)
        );

        -- 3. DELETE: Only the uploader (owner) or a society administrator can remove evidence
        CREATE POLICY "evidence_delete_uploader_or_admin" ON storage.objects
        FOR DELETE TO authenticated
        USING (
            bucket_id = 'complaint-evidence'
            AND (
                owner = auth.uid()
                OR (
                    split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
                    AND public.has_society_role(split_part(name, '/', 1)::uuid, ARRAY['society_admin'])
                )
            )
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Attachment Cleanup Policy on public.complaint_attachments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "attachments_delete_uploader_or_admin" ON public.complaint_attachments;

CREATE POLICY "attachments_delete_uploader_or_admin" ON public.complaint_attachments
FOR DELETE TO authenticated
USING (
    uploaded_by = public.auth_user_id()
    OR public.has_society_role(society_id, ARRAY['society_admin'])
);

-- ------------------------------------------------------------------------------
-- 4. Default Society Provisioning (Departments & Categories)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_society_standard_departments_and_categories(p_society_id uuid)
RETURNS void AS $$
DECLARE
    dept_electrical uuid;
    dept_water uuid;
    dept_elevators uuid;
    dept_sanitation uuid;
    dept_security uuid;
BEGIN
    -- Check if departments already exist for this society
    IF EXISTS (SELECT 1 FROM public.departments WHERE society_id = p_society_id) THEN
        RETURN;
    END IF;

    -- 1. Insert Core Housing Society Departments
    INSERT INTO public.departments (society_id, name, description)
    VALUES (p_society_id, 'Electrical & Power', 'Internal wiring, common lighting, transformers, and meter rooms')
    RETURNING id INTO dept_electrical;

    INSERT INTO public.departments (society_id, name, description)
    VALUES (p_society_id, 'Water Supply & Plumbing', 'Overhead tanks, borewells, drainage lines, and water motors')
    RETURNING id INTO dept_water;

    INSERT INTO public.departments (society_id, name, description)
    VALUES (p_society_id, 'Elevators & Lifts', 'Passenger lifts, service elevators, and annual safety maintenance')
    RETURNING id INTO dept_elevators;

    INSERT INTO public.departments (society_id, name, description)
    VALUES (p_society_id, 'Civil & Sanitation', 'Compound paving, waste chutes, rainwater harvesting, and terrace waterproofing')
    RETURNING id INTO dept_sanitation;

    INSERT INTO public.departments (society_id, name, description)
    VALUES (p_society_id, 'Security & Access Control', 'Main gates, boom barriers, intercom systems, and CCTV surveillance')
    RETURNING id INTO dept_security;

    -- 2. Insert Standard Housing Society Complaint Categories with default priorities and SLAs
    INSERT INTO public.complaint_categories (society_id, department_id, name, default_priority, sla_hours, description)
    VALUES
        (p_society_id, dept_electrical, 'Streetlight & Common Area Lighting', 'medium', 24, 'Flickering or non-functioning exterior and corridor lights'),
        (p_society_id, dept_electrical, 'Power Fluctuations & Meter Room Faults', 'high', 12, 'Voltage issues or sparking near sub-stations'),
        (p_society_id, dept_water, 'Water Supply Disruption & Low Pressure', 'high', 12, 'No water supply during regular morning or evening supply hours'),
        (p_society_id, dept_water, 'Common Drainage Overflow & Pipe Leakage', 'urgent', 8, 'Sewage line blockage or burst drainage line in shafts'),
        (p_society_id, dept_elevators, 'Lift Stoppage / Trapped Passenger / Door Jerk', 'urgent', 2, 'Elevator trapped between floors or door sensor malfunction'),
        (p_society_id, dept_sanitation, 'Garbage Collection & Waste Chute Jam', 'medium', 24, 'Chute blockage, missed wet/dry waste collection'),
        (p_society_id, dept_sanitation, 'Paver Block Damage & Road Potholes', 'low', 72, 'Loose paving tiles or potholes inside the society perimeter'),
        (p_society_id, dept_security, 'CCTV Camera Offline / Intercom Breakdown', 'medium', 24, 'Security camera blindspot or faulty guard intercom'),
        (p_society_id, dept_security, 'Main Gate Barrier & Boom Barrier Failure', 'high', 12, 'Automated vehicle access barrier stuck or damaged');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically seed standard departments and categories on new society creation
CREATE OR REPLACE FUNCTION public.trg_auto_provision_society_defaults()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_society_standard_departments_and_categories(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_societies_auto_provision ON public.societies;

CREATE TRIGGER trg_societies_auto_provision
AFTER INSERT ON public.societies
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_provision_society_defaults();
