-- Remove the legacy singleton trigger on settings. Each user must have their own row.
DROP TRIGGER IF EXISTS trg_settings_singleton ON public.settings;
DROP FUNCTION IF EXISTS public.impune_settings_singleton();
