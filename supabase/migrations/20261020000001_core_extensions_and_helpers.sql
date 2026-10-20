-- ==============================================================================
-- Migration: 20261020000001_core_extensions_and_helpers.sql
-- Description: Core extensions, security helper functions, and audit trigger engine
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Utility: Auto-updating updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Security Helper: Extract authenticated user ID safely
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS uuid AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Security Helper: Check if current user is platform administrator
-- Uses SECURITY DEFINER to bypass RLS recursion when reading profiles
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
DECLARE
    admin_flag boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT is_platform_admin INTO admin_flag
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN COALESCE(admin_flag, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Security Helper: Check user's active role within a given society
-- Uses SECURITY DEFINER to prevent RLS recursion on society_memberships
CREATE OR REPLACE FUNCTION public.get_user_society_role(target_society_id uuid)
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    IF auth.uid() IS NULL OR target_society_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT role INTO user_role
    FROM public.society_memberships
    WHERE society_id = target_society_id
      AND user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;

    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Security Helper: Check if user has one of the allowed roles in a society
CREATE OR REPLACE FUNCTION public.has_society_role(target_society_id uuid, required_roles text[])
RETURNS boolean AS $$
DECLARE
    current_role text;
BEGIN
    IF public.is_platform_admin() THEN
        RETURN true;
    END IF;

    current_role := public.get_user_society_role(target_society_id);
    IF current_role IS NULL THEN
        RETURN false;
    END IF;

    RETURN current_role = ANY(required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Security Helper: Check if user is an approved resident of a society
CREATE OR REPLACE FUNCTION public.is_society_member(target_society_id uuid)
RETURNS boolean AS $$
BEGIN
    IF public.is_platform_admin() THEN
        RETURN true;
    END IF;

    RETURN public.get_user_society_role(target_society_id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
