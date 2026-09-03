/**
 * notificationService.ts — Notificări Supabase
 * Folosit în: componenta de notifications badge (viitoare)
 */
import { supabase, getCurrentUser } from '../supabase';
import type { Notificare } from '../database.types';

// ── Citire notificări necitite ─────────────────────────────────
export async function getUnreadNotifications(): Promise<Notificare[]> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('notificari')
    .select('*')
    .eq('citita', false)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Eroare la citirea notificărilor: ' + error.message);
  return data ?? [];
}

// ── Număr notificări necitite (pentru badge) ───────────────────
export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();
  const { count, error } = await supabase
    .from('notificari')
    .select('id', { count: 'exact', head: true })
    .eq('citita', false)
    .eq('user_id', user.id);

  if (error) return 0;
  return count ?? 0;
}

// ── Marcare citită ─────────────────────────────────────────────
export async function markAsRead(id: string) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notificari')
    // @ts-ignore
    .update({ citita: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error('Eroare la marcarea notificării: ' + error.message);
}

// ── Marcare toate citite ───────────────────────────────────────
export async function markAllAsRead() {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notificari')
    // @ts-ignore
    .update({ citita: true })
    .eq('citita', false)
    .eq('user_id', user.id);

  if (error) throw new Error('Eroare la marcarea notificărilor: ' + error.message);
}
