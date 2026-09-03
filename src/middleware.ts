import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabaseServer';

const PUBLIC_ROUTES = ['/login', '/signup', '/api/auth'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;

  // Allow public routes and static assets
  if (
    PUBLIC_ROUTES.some(route => url.pathname.startsWith(route)) ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return next();
  }

  // Check session server-side
  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect('/login');
  }

  return next();
});
