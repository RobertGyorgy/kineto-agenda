-- Ensure only one settings row per user
ALTER TABLE public.settings ADD CONSTRAINT IF NOT EXISTS settings_user_id_unique UNIQUE (user_id);
