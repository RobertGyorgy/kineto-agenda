-- Make pacienti_view enforce RLS of the calling user instead of the view owner
ALTER VIEW public.pacienti_view SET (security_invoker = true);
