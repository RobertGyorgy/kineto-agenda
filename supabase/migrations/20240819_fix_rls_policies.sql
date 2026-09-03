-- Migration: tighten RLS policies that were overly permissive
-- Removes anonymous-access policies on tables that should require authentication.

-- 1. Remove anonymous-all policy on plati (keep authenticated-only policy)
DROP POLICY IF EXISTS "Allow all access to plati" ON public.plati;

-- 2. Remove anonymous-all policies on legacy/unused tables
DROP POLICY IF EXISTS "Allow anon all on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon all on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow anon all on packages" ON public.packages;

-- 3. Ensure the active tables still have authenticated-only access
-- (pacienti, programari, plati, settings, notificari, istoric_saptamanal,
--  pricing_packages, error_logs, profiles already have authenticated policies)
