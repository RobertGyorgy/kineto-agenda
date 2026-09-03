-- Creare tabel plati pentru evidenta exacta a incasarilor
CREATE TABLE IF NOT EXISTS public.plati (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pacient_id UUID NOT NULL REFERENCES public.pacienti(id) ON DELETE CASCADE,
    suma NUMERIC NOT NULL,
    data_platii DATE NOT NULL DEFAULT CURRENT_DATE,
    metoda TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pentru cautari mai rapide in statistici
CREATE INDEX IF NOT EXISTS idx_plati_data_platii ON public.plati(data_platii);
CREATE INDEX IF NOT EXISTS idx_plati_pacient_id ON public.plati(pacient_id);

-- Securitate RLS (presupunand ca toate datele sunt publice/autentificate la comun momentan, la fel ca restul)
ALTER TABLE public.plati ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users on plati" ON public.plati FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users on plati" ON public.plati FOR SELECT USING (true);
