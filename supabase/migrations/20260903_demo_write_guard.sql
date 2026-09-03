-- 20260903_demo_write_guard.sql
-- Contul demo (a455f8e1-64e8-4f23-9016-4583df9f0377) este DOAR pentru citire
-- în baza de date. Aplicația rutează scrierile contului demo în localStorage;
-- acest trigger blochează și scrierile directe (API/postgres), pentru că
-- parola contului demo este publică în bundle-ul client.

CREATE OR REPLACE FUNCTION public.blocheaza_scrieri_demo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = 'a455f8e1-64e8-4f23-9016-4583df9f0377'::uuid THEN
    RAISE EXCEPTION 'Contul demo este doar pentru vizualizare.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'programari', 'pacienti', 'plati', 'settings', 'profiles',
    'pricing_packages', 'notificari', 'push_subscriptions',
    'istoric_saptamanal', 'error_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_blocheaza_demo ON public.%I;
       CREATE TRIGGER trg_blocheaza_demo
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.blocheaza_scrieri_demo();',
      t, t
    );
  END LOOP;
END $$;
