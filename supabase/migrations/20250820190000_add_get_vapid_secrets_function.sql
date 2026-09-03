-- Helper that lets the check-reminders Edge Function read VAPID keys from Supabase Vault
-- without directly querying vault.decrypted_secrets over PostgREST.
CREATE OR REPLACE FUNCTION public.get_vapid_secrets()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  result JSON := '{}';
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT name, decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name IN ('VAPID_PRIVATE_JWK', 'VAPID_SUBJECT')
  LOOP
    result := jsonb_set(result::jsonb, ARRAY[rec.name], to_jsonb(rec.decrypted_secret))::json;
  END LOOP;
  RETURN result;
END;
$$;

-- Only the service_role (used by Edge Functions) may call this.
REVOKE EXECUTE ON FUNCTION public.get_vapid_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_secrets() TO service_role;
