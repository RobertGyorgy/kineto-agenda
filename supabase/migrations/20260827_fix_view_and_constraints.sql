-- ============================================================
-- Migration: Fix DB constraints & pacienti_view schema mismatch
-- Data: 2026-08-27
-- ============================================================

-- 1. Permite starea 'inactiv' în check constraint pe pacienti
ALTER TABLE public.pacienti DROP CONSTRAINT IF EXISTS pacienti_status_abonament_check;
ALTER TABLE public.pacienti ADD CONSTRAINT pacienti_status_abonament_check 
  CHECK (status_abonament IN ('activ', 'ultima_sedinta', 'terminat', 'inactiv'));

-- 2. Corectează pacienti_view pentru a oferi ambele nume de câmpuri (suma_incasata & total_incasat) și nume complet (name)
DROP VIEW IF EXISTS public.pacienti_view CASCADE;

CREATE VIEW public.pacienti_view AS
SELECT
  p.id,
  p.user_id,
  p.nume,
  p.prenume,
  TRIM(COALESCE(p.prenume, '') || ' ' || COALESCE(p.nume, '')) AS name,
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
  COALESCE(SUM(pl.suma), 0) AS suma_incasata,
  COALESCE(SUM(pl.suma), 0) AS total_incasat,
  COUNT(DISTINCT pr.id) AS numar_programari
FROM public.pacienti p
LEFT JOIN public.plati pl ON pl.pacient_id = p.id
LEFT JOIN public.programari pr ON pr.pacient_id = p.id
GROUP BY p.id;

-- Rulează cu drepturile utilizatorului curent (RLS invoker)
ALTER VIEW public.pacienti_view SET (security_invoker = true);

-- 3. Actualizează funcția arhiveaza_saptamana pentru suport multi-user
CREATE OR REPLACE FUNCTION public.arhiveaza_saptamana(saptamana_start DATE DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  start_zi    DATE;
  sfarsit_zi  DATE;
  u_rec       RECORD;
BEGIN
  start_zi   := COALESCE(saptamana_start, (date_trunc('week', CURRENT_DATE - INTERVAL '7 days'))::date);
  sfarsit_zi := start_zi + 6;

  -- Procesează arhivarea pentru fiecare utilizator în parte
  FOR u_rec IN SELECT DISTINCT user_id FROM public.programari WHERE user_id IS NOT NULL LOOP
    INSERT INTO public.istoric_saptamanal
      (user_id, saptamana_start, saptamana_end, total_programari, finalizate, absente, anulate, procent_prezenta, venit_total)
    SELECT
      u_rec.user_id,
      start_zi,
      sfarsit_zi,
      count(*),
      count(*) FILTER (WHERE pr.status = 'finalizat'),
      count(*) FILTER (WHERE pr.status = 'absent'),
      count(*) FILTER (WHERE pr.status = 'anulat'),
      CASE WHEN count(*) > 0 THEN ROUND((count(*) FILTER (WHERE pr.status = 'finalizat')::numeric / count(*)::numeric) * 100, 2) ELSE 0 END,
      COALESCE(SUM(p.cost) FILTER (WHERE pr.status = 'finalizat'), 0)
    FROM public.programari pr
    JOIN public.pacienti p ON p.id = pr.pacient_id
    WHERE pr.user_id = u_rec.user_id
      AND pr.data BETWEEN start_zi AND sfarsit_zi
    ON CONFLICT (saptamana_start) DO UPDATE SET
      total_programari = EXCLUDED.total_programari,
      finalizate       = EXCLUDED.finalizate,
      absente          = EXCLUDED.absente,
      anulate          = EXCLUDED.anulate,
      procent_prezenta = EXCLUDED.procent_prezenta,
      venit_total      = EXCLUDED.venit_total;
  END LOOP;
END;
$$;
