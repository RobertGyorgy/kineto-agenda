-- Script Migrare Supabase Corectat (fără duplicat pe coloana sedinte_folosite)
-- Execută în: https://supabase.com/dashboard/project/dlklegayibhgnrxnqapm/sql/new

-- 1. Creează tabela de plăți
CREATE TABLE IF NOT EXISTS public.plati (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pacient_id UUID NOT NULL REFERENCES public.pacienti(id) ON DELETE CASCADE,
    suma NUMERIC(10, 2) NOT NULL,
    data_platii DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Permisiuni RLS
ALTER TABLE public.plati ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to plati" ON public.plati;
CREATE POLICY "Allow all access to plati" ON public.plati FOR ALL USING (true) WITH CHECK (true);

-- 3. Șterge vizualizarea existentă cu CASCADE
DROP VIEW IF EXISTS public.pacienti_view CASCADE;

-- 4. Re-creează vizualizarea pacienți fără duplicați de coloane
CREATE VIEW public.pacienti_view AS
SELECT 
    p.id,
    p.nume,
    p.prenume,
    (p.prenume || ' ' || p.nume) AS name,
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
