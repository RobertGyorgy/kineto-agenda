-- Remove the 25-minute overlap guardrail so multiple patients can be scheduled
-- at the same time slot (e.g. 5 patients at 22:00).
DROP TRIGGER IF EXISTS trg_valideaza_programare ON public.programari;
DROP FUNCTION IF EXISTS public.valideaza_programare();
