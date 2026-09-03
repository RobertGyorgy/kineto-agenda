-- Update the cron wrapper to authenticate the check-reminders Edge Function
-- with a dedicated CRON_SECRET stored in Supabase Vault.
--
-- Before applying, create the Vault secret:
--   SELECT vault.create_secret('<random-strong-secret>', 'CRON_SECRET', 'Cron auth for check-reminders Edge Function');

CREATE OR REPLACE FUNCTION public.run_check_reminders_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  cron_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found in Vault';
  END IF;

  PERFORM net.http_get(
    url := 'https://dlklegayibhgnrxnqapm.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'x-cron-secret', cron_secret,
      'Content-Type', 'application/json'
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_check_reminders_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_check_reminders_cron() TO service_role;
