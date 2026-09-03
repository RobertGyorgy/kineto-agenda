-- Old permissive policies allow all rows for public/authenticated.
-- They conflict with the new isolation policies, so we drop them.
DROP POLICY IF EXISTS "acces pacienti" ON public.pacienti;
DROP POLICY IF EXISTS "acces programari" ON public.programari;
DROP POLICY IF EXISTS "acces plati" ON public.plati;
DROP POLICY IF EXISTS "acces notificari" ON public.notificari;
DROP POLICY IF EXISTS "acces istoric" ON public.istoric_saptamanal;
DROP POLICY IF EXISTS "acces settings" ON public.settings;
DROP POLICY IF EXISTS "acces profiles" ON public.profiles;
DROP POLICY IF EXISTS "acces error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "acces push_subscriptions" ON public.push_subscriptions;

-- Old pricing_packages policies allowed any authenticated user full access.
DROP POLICY IF EXISTS "Allow authenticated users to delete pricing_packages" ON public.pricing_packages;
DROP POLICY IF EXISTS "Allow authenticated users to insert pricing_packages" ON public.pricing_packages;
DROP POLICY IF EXISTS "Allow authenticated users to read pricing_packages" ON public.pricing_packages;
DROP POLICY IF EXISTS "Allow authenticated users to update pricing_packages" ON public.pricing_packages;
