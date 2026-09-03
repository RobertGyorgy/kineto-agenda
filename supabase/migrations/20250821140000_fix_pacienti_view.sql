-- Fix pacienti_view to expose the fields the UI expects
DROP VIEW IF EXISTS public.pacienti_view;

CREATE VIEW public.pacienti_view AS
SELECT
  p.*,
  TRIM(COALESCE(p.prenume, '') || ' ' || COALESCE(p.nume, '')) AS name,
  COALESCE(SUM(pl.suma), 0) AS suma_incasata,
  COUNT(DISTINCT pr.id) AS numar_programari
FROM public.pacienti p
LEFT JOIN public.plati pl ON pl.pacient_id = p.id
LEFT JOIN public.programari pr ON pr.pacient_id = p.id
GROUP BY p.id;
