-- Migration: decrement sedinte_folosite when a finalized session is deleted
-- Fixes bug where confirming, deleting and re-creating the same session counted it twice.

CREATE OR REPLACE FUNCTION public.incrementeaza_sedinte_folosite()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.status = 'finalizat' AND (OLD.status IS NULL OR OLD.status <> 'finalizat') THEN
      UPDATE public.pacienti
      SET sedinte_folosite = LEAST(sedinte_folosite + 1, sedinte_total)
      WHERE id = NEW.pacient_id;
    END IF;

    IF OLD.status = 'finalizat' AND NEW.status <> 'finalizat' THEN
      UPDATE public.pacienti
      SET sedinte_folosite = GREATEST(sedinte_folosite - 1, 0)
      WHERE id = NEW.pacient_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status = 'finalizat' THEN
    UPDATE public.pacienti
    SET sedinte_folosite = GREATEST(sedinte_folosite - 1, 0)
    WHERE id = OLD.pacient_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incrementeaza_sedinte ON public.programari;
CREATE TRIGGER trg_incrementeaza_sedinte
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.programari
  FOR EACH ROW EXECUTE FUNCTION public.incrementeaza_sedinte_folosite();
