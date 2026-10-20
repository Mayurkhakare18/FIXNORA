-- ==============================================================================
-- Migration: 20261020000002_society_membership_schema.sql
-- Description: Tables 1 to 7: Profiles, Societies, Buildings, Flats, Memberships, Departments, Categories
-- ==============================================================================

-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text,
    avatar_url text,
    preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'mr')),
    is_platform_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Societies Table (Tenant Root)
CREATE TABLE IF NOT EXISTS public.societies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    registration_number text NOT NULL UNIQUE,
    address text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    pincode text NOT NULL,
    rules_summary text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_societies_updated_at
BEFORE UPDATE ON public.societies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Buildings Table (Towers / Wings within a Society)
CREATE TABLE IF NOT EXISTS public.buildings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    name text NOT NULL,
    total_floors integer NOT NULL DEFAULT 1 CHECK (total_floors >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_building_society_name UNIQUE (society_id, name)
);

CREATE INDEX IF NOT EXISTS idx_buildings_society_id ON public.buildings(society_id);

-- 4. Flats Table (Individual Units)
CREATE TABLE IF NOT EXISTS public.flats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    flat_number text NOT NULL,
    floor integer NOT NULL DEFAULT 0 CHECK (floor >= 0),
    occupancy_type text NOT NULL DEFAULT 'owner_occupied' CHECK (occupancy_type IN ('owner_occupied', 'tenant', 'vacant')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_flat_building_number UNIQUE (building_id, flat_number)
);

CREATE INDEX IF NOT EXISTS idx_flats_society_id ON public.flats(society_id);
CREATE INDEX IF NOT EXISTS idx_flats_building_id ON public.flats(building_id);

-- 5. Society Memberships Table (Role and Flat Association)
CREATE TABLE IF NOT EXISTS public.society_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flat_id uuid REFERENCES public.flats(id) ON DELETE SET NULL,
    role text NOT NULL CHECK (role IN ('resident', 'society_admin', 'maintenance_staff', 'supervisor')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    staff_designation text, -- Strictly in-house role (e.g. Senior Electrician, Plumber)
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_society_membership UNIQUE (society_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_society_id ON public.society_memberships(society_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.society_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.society_memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON public.society_memberships(role);

CREATE TRIGGER trg_society_memberships_updated_at
BEFORE UPDATE ON public.society_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Departments Table (In-house Maintenance & Facility Departments)
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    head_officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_department_society_name UNIQUE (society_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_society_id ON public.departments(society_id);

-- 7. Complaint Categories Table
CREATE TABLE IF NOT EXISTS public.complaint_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name text NOT NULL,
    default_priority text NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
    sla_hours integer NOT NULL DEFAULT 48 CHECK (sla_hours > 0),
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_society_name UNIQUE (society_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_society_id ON public.complaint_categories(society_id);
CREATE INDEX IF NOT EXISTS idx_categories_department_id ON public.complaint_categories(department_id);
