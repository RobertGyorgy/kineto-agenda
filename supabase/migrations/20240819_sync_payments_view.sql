-- Migration: ensure plati table exists and pacienti_view includes suma_incasata
-- Idempotent — safe to run multiple times.

-- 1. Plati table
CREATE TABLE IF NOT EXISTS public.plati (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id  UUID        NOT NULL REFERENCES public.pacienti(id) ON DELETE CASCADE,
  suma        NUMERIC(10, 2) NOT NULL,
  data_platii DATE        NOT NULL DEFAULT CURRENT_DATE,
  metoda      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plati_pacient ON public.plati (pacient_id);
CREATE INDEX IF NOT EXISTS idx_plati_data     ON public.plati (data_platii);

ALTER TABLE public.plati ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to plati" ON public.plati;
CREATE POLICY "Allow all access to plati" ON public.plati FOR ALL USING (true) WITH CHECK (true);

-- 1b. Ensure plati has the metoda column (schema drift fix)
ALTER TABLE public.plati
ADD COLUMN IF NOT EXISTS metoda TEXT;

-- 2. Ensure sedinte_ramase exists on pacienti (matches schema v3)
ALTER TABLE public.pacienti
ADD COLUMN IF NOT EXISTS sedinte_ramase INTEGER
GENERATED ALWAYS AS (sedinte_total - sedinte_folosite) STORED;

-- 3. Refresh view with suma_incasata
DROP VIEW IF EXISTS public.pacienti_view CASCADE;
CREATE VIEW public.pacienti_view AS
SELECT
  p.id,
  p.prenume || ' ' || p.nume                       AS name,
  p.nume,
  p.prenume,
  p.telefon,
  p.locatie,
  p.plan,
  p.frecventa,
  p.cost,
  p.sedinte_total,
  p.sedinte_folosite,
  p.sedinte_ramase,
  p.achitat,
  p.status_abonament,
  p.notite,
  p.drive_link,
  p.created_at,
  p.updated_at,
  COALESCE((SELECT SUM(pl.suma) FROM public.plati pl WHERE pl.pacient_id = p.id), 0) AS suma_incasata
FROM public.pacienti p;
