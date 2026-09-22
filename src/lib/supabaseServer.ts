/**
 * supabaseServer.ts — Server-side Supabase client (Astro context)
 * Folosit în middleware, API routes și frontmatter server-side.
 */
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { Database } from './database.types';

// Polyfill WebSocket pentru Node.js < 22.
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    const wsModule = await import('ws');
    const WS = (wsModule as any).default || (wsModule as any).WebSocket || wsModule;
    (globalThis as any).WebSocket = WS;
  } catch {
    // ignore
  }
}

export function getSupabaseEnv() {
  const url =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env ? process.env.PUBLIC_SUPABASE_URL : '') ||
    '';
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env ? process.env.PUBLIC_SUPABASE_ANON_KEY : '') ||
    '';
  return { url, key };
}

export function createSupabaseServerClient(cookies: AstroCookies, headers?: Headers) {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    throw new Error('❌ Lipsesc variabilele de mediu Supabase (PUBLIC_SUPABASE_URL sau PUBLIC_SUPABASE_ANON_KEY).');
  }

  const cookieHeader = headers?.get('cookie') ?? '';

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
