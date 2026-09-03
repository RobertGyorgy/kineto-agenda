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

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Lipsesc variabilele de mediu Supabase. Verifică fișierul .env');
}

export function createSupabaseServerClient(cookies: AstroCookies, headers?: Headers) {
  const cookieHeader = headers?.get('cookie') ?? '';

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
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
