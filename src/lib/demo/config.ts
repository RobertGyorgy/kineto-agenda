/**
 * config.ts — Identitatea contului demo.
 *
 * Contul există în Supabase Auth (creat cu scripts/create-demo-user.mjs).
 * Parola este vizibilă în bundle-ul client — este acceptabil: contul este
 * doar pentru demonstrație, iar în Postgres un trigger (migrația
 * 20260903_demo_write_guard.sql) blochează ORICE scriere venită de la acest
 * utilizator. Aplicația rutează toate operațiunile contului demo către
 * localStorage (vezi src/lib/demo/).
 */

export const DEMO_EMAIL = 'demo@kineto-agenda.ro';
export const DEMO_PASSWORD = 'dcf93f4e5f294f50ab8afadcc477795bA1!';
export const DEMO_USER_ID = 'a455f8e1-64e8-4f23-9016-4583df9f0377';

export function isDemoUserId(userId: string | null | undefined): boolean {
  return !!userId && userId === DEMO_USER_ID;
}
