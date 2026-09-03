-- Cron wrapper that invokes the check-reminders Edge Function with an Authorization header.
-- The anon JWT is stored in Supabase Vault under EDGE_FUNCTION_ANON_JWT so it is not
-- hard-coded in the cron.job row or in source control.
--
-- Make sure the Vault secret exists before applying this migration:
--   SELECT vault.create_secret('<anon-jwt>', 'EDGE_FUNCTION_ANON_JWT', '...');
CREATE OR REPLACE FUNCTION public.run_check_reminders_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  anon_jwt TEXT;
BEGIN
  SELECT decrypted_secret INTO anon_jwt
  FROM vault.decrypted_secrets
  WHERE name = 'EDGE_FUNCTION_ANON_JWT'
  LIMIT 1;

  IF anon_jwt IS NULL THEN
    RAISE EXCEPTION 'EDGE_FUNCTION_ANON_JWT not found in Vault';
  END IF;

  PERFORM net.http_get(
    url := 'https://dlklegayibhgnrxnqapm.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || anon_jwt,
      'Content-Type', 'application/json'
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_check_reminders_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_check_reminders_cron() TO service_role;

-- Replace any previous check-reminders cron job with the secure wrapper.
SELECT cron.unschedule('check-reminders-job');
SELECT cron.schedule(
  'check-reminders-job',
  '* * * * *',
  'SELECT public.run_check_reminders_cron();'
);
