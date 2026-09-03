-- Migration: user isolation — each user sees only their own data
-- Existing data is assigned to the test@test.com user.

DO $$
DECLARE
  default_user_id uuid := '9c653373-36ad-4854-9253-5f8c96ae6126'::uuid;
BEGIN

  -- ── 1. pacienti ──
  ALTER TABLE public.pacienti ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.pacienti SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 2. programari ──
  ALTER TABLE public.programari ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.programari SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 3. plati ──
  ALTER TABLE public.plati ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.plati SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 4. notificari ──
  ALTER TABLE public.notificari ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.notificari SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 5. istoric_saptamanal ──
  ALTER TABLE public.istoric_saptamanal ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.istoric_saptamanal SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 6. settings ──
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.settings SET user_id = default_user_id WHERE user_id IS NULL;

  -- ── 7. pricing_packages ──
  ALTER TABLE public.pricing_packages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.pricing_packages SET user_id = default_user_id WHERE user_id IS NULL;

  -- Ensure a settings row exists for every auth user
  INSERT INTO public.settings (user_id)
  SELECT id FROM auth.users
  WHERE id NOT IN (SELECT user_id FROM public.settings WHERE user_id IS NOT NULL)
  ON CONFLICT DO NOTHING;

  -- Ensure a profile row exists for every auth user
  INSERT INTO public.profiles (id, username)
  SELECT id, split_part(email, '@', 1) FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT DO NOTHING;

END $$;

-- ── RLS policies ──

-- pacienti
ALTER TABLE public.pacienti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacienti_isolation_policy ON public.pacienti;
CREATE POLICY pacienti_isolation_policy ON public.pacienti
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- programari
ALTER TABLE public.programari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS programari_isolation_policy ON public.programari;
CREATE POLICY programari_isolation_policy ON public.programari
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- plati
ALTER TABLE public.plati ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plati_isolation_policy ON public.plati;
CREATE POLICY plati_isolation_policy ON public.plati
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- notificari
ALTER TABLE public.notificari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificari_isolation_policy ON public.notificari;
CREATE POLICY notificari_isolation_policy ON public.notificari
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- istoric_saptamanal
ALTER TABLE public.istoric_saptamanal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS istoric_saptamanal_isolation_policy ON public.istoric_saptamanal;
CREATE POLICY istoric_saptamanal_isolation_policy ON public.istoric_saptamanal
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_isolation_policy ON public.settings;
CREATE POLICY settings_isolation_policy ON public.settings
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- pricing_packages
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_packages_isolation_policy ON public.pricing_packages;
CREATE POLICY pricing_packages_isolation_policy ON public.pricing_packages
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_isolation_policy ON public.profiles;
CREATE POLICY profiles_isolation_policy ON public.profiles
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- error_logs: allow users to insert their own logs, view only their own
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS error_logs_isolation_policy ON public.error_logs;
CREATE POLICY error_logs_isolation_policy ON public.error_logs
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_isolation_policy ON public.push_subscriptions;
CREATE POLICY push_subscriptions_isolation_policy ON public.push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Function + trigger: create profile and settings for new users ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Update pacienti_view to include user_id ──
DROP VIEW IF EXISTS public.pacienti_view;
CREATE VIEW public.pacienti_view AS
SELECT
  p.*,
  COALESCE(SUM(pl.suma), 0) AS total_incasat,
  COUNT(DISTINCT pr.id) AS numar_programari
FROM public.pacienti p
LEFT JOIN public.plati pl ON pl.pacient_id = p.id
LEFT JOIN public.programari pr ON pr.pacient_id = p.id
GROUP BY p.id;

-- RLS on the view is not supported; policies on pacienti protect the underlying rows.
