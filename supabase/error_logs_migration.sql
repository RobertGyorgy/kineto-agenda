-- ============================================================
-- Migrare: tabela error_logs pentru jurnal automat de erori
-- Rulează în: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Tabela de loguri
CREATE TABLE IF NOT EXISTS public.error_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  type            TEXT         NOT NULL DEFAULT 'error'
                    CHECK (type IN ('error','warning','fetch','rejection','manual')),
  source          TEXT         NOT NULL DEFAULT 'app',
  message         TEXT         NOT NULL,
  details         TEXT,
  stack           TEXT,
  interpretation  TEXT         NOT NULL,
  user_agent      TEXT,
  app_version     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id    ON public.error_logs (user_id);

-- 2. Row Level Security
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Utilizatorii autentificați pot insera propriile loguri.
CREATE POLICY "utilizator insereaza propriile loguri" ON public.error_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Doar utilizatorii autentificați pot citi logurile (terapeutul unic vede tot).
CREATE POLICY "admin citeste loguri" ON public.error_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Permisiuni pentru rolul authenticated
GRANT SELECT, INSERT ON public.error_logs TO authenticated;
