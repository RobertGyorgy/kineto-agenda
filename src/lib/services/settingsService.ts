/**
 * settingsService.ts — Setări aplicație (singleton Supabase)
 * Folosit în: SettingsView.astro
 */
import { supabase } from '../supabase';
import type { Settings } from '../database.types';

export interface PricingPreset {
  id: string;
  name: string;
  plan: 'Abonament' | 'Ședință unică';
  total_sessions: number;
  price: number;
}

export const DEFAULT_PRICING_PRESETS: PricingPreset[] = [
  { id: 'p1', name: 'Abonament Standard', plan: 'Abonament', total_sessions: 10, price: 1500 },
  { id: 'p2', name: 'Program Individual', plan: 'Abonament', total_sessions: 10, price: 1800 },
  { id: 'p3', name: 'Ședință unică', plan: 'Ședință unică', total_sessions: 1, price: 150 },
];

const DEFAULT_SETTINGS: Settings & { pricing_presets?: PricingPreset[] } = {
  therapist_name: 'Roxana',
  work_start: '08:00',
  work_end: '18:00',
  lunch_start: '13:00',
  lunch_end: '14:00',
  session_duration: 50,
  break_buffer: 10,
  zile_lucratoare: [1, 2, 3, 4, 5],
  default_price: 150,
  default_total_sessions: 10,
  categories: ['Belaqva', 'Ghimbav', 'Neachitați', 'Achitați'],
  active_categories: ['Belaqva', 'Ghimbav', 'Neachitați', 'Achitați'],
  lunch_breaks: {},
} as any;

// ── Citire settings (cu cache local instant pentru 0ms delay pe mobil) ──
export async function getSettings(): Promise<Settings> {
  let cached: Settings | null = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('kineto_settings_cache');
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (cached) return cached;
    return DEFAULT_SETTINGS;
  }

  try {
    const { data, error } = await (supabase as any)
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('getSettings warning:', error);
      if (cached) return cached;
    }

    if (!data) {
      const fallback = {
        ...DEFAULT_SETTINGS,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };
      return fallback as Settings;
    }

    const result = {
      ...DEFAULT_SETTINGS,
      ...data,
      work_start: (data.work_start || '08:00').substring(0, 5),
      work_end: (data.work_end || '18:00').substring(0, 5),
      lunch_start: (data.lunch_start || '12:00').substring(0, 5),
      lunch_end: (data.lunch_end || '12:30').substring(0, 5),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('kineto_settings_cache', JSON.stringify(result));
      } catch (e) {}
    }

    return result;
  } catch (err) {
    console.error('getSettings error:', err);
    if (cached) return cached;
    return DEFAULT_SETTINGS;
  }
}

// ── Salvare settings (UPDATE pe singurul rând existent, INSERT dacă lipsește) ────────
export async function saveSettings(updates: Partial<Settings>): Promise<Settings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Trebuie să fii autentificat pentru a salva setările.');

  const { data: existing } = await (supabase as any)
    .from('settings')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let data: any;
  let error: any;

  if (!existing) {
    const insertResult = await (supabase as any)
      .from('settings')
      .insert({ ...DEFAULT_SETTINGS, user_id: user.id, ...updates })
      .select()
      .maybeSingle();
    data = insertResult.data;
    error = insertResult.error;
  } else {
    const updateResult = await (supabase as any)
      .from('settings')
      .update(updates)
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();
    data = updateResult.data;
    error = updateResult.error;
  }

  if (error) throw new Error('Eroare la salvarea setărilor: ' + error.message);
  if (!data) throw new Error('Setările nu au putut fi salvate.');

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kineto_settings_cache', JSON.stringify(data));
    } catch (e) {}
  }

  return data;
}

// ── Salvare profil terapeut (din Settings → Profil personal) ──
export async function saveProfile(updates: {
  display_name?: string;
  telefon?: string;
  username?: string;
  email?: string;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Trebuie să fii autentificat pentru a salva profilul în baza de date.');
  }

  let username = updates.username ? updates.username.trim() : '';
  if (!username) {
    username = user.email ? `@${user.email.split('@')[0]}` : '@utilizator';
  }
  if (!username.startsWith('@')) {
    username = `@${username}`;
  }

  const profileDataToSave = {
    id: user.id,
    display_name: updates.display_name !== undefined ? updates.display_name.trim() : '',
    telefon: updates.telefon !== undefined ? updates.telefon.trim() : '',
    username: username,
    updated_at: new Date().toISOString()
  };

  // 1. Salvare în tabela `profiles` din Supabase (cu upsert)
  const { error: upsertError } = await (supabase as any)
    .from('profiles')
    .upsert(profileDataToSave, { onConflict: 'id' });

  if (upsertError) {
    // Fallback: încercăm update dacă upsert are probleme de permisiune
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        display_name: profileDataToSave.display_name,
        telefon: profileDataToSave.telefon,
        username: profileDataToSave.username,
        updated_at: profileDataToSave.updated_at
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error('Eroare la salvarea în baza de date: ' + (updateError.message || upsertError.message));
    }
  }

  // 2. Salvare și în user_metadata Supabase Auth (garanție dublă de persistență)
  try {
    const authUpdatePayload: any = {
      data: {
        telefon: profileDataToSave.telefon,
        phone: profileDataToSave.telefon,
        display_name: profileDataToSave.display_name,
        username: profileDataToSave.username
      }
    };
    if (updates.email && updates.email.trim() && updates.email.trim() !== user.email) {
      authUpdatePayload.email = updates.email.trim();
    }
    await supabase.auth.updateUser(authUpdatePayload);
  } catch (authErr: any) {
    console.warn('Actualizare profil în auth metadata:', authErr?.message);
  }

  // 3. Sincronizează `therapist_name` în tabela `settings` din DB
  if (profileDataToSave.display_name) {
    try {
      await saveSettings({ therapist_name: profileDataToSave.display_name });
    } catch (sErr) {
      console.warn('Sincronizare therapist_name în settings:', sErr);
    }
  }

  // 4. Salvează în cache local pentru viteză
  const fullProfile = { ...profileDataToSave, email: updates.email || user.email || '' };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kineto_profile_cache', JSON.stringify(fullProfile));
      window.dispatchEvent(new CustomEvent('profileUpdated', { detail: fullProfile }));
    } catch (e) {}
  }

  return fullProfile;
}

// ── Citire profil terapeut ─────────────────────────────────────
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();

  let cached: any = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('kineto_profile_cache');
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}
  }

  if (user?.id) {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const fullProfile = {
          ...data,
          display_name: data.display_name || user.user_metadata?.display_name || user.user_metadata?.name || cached?.display_name || '',
          telefon: data.telefon || user.user_metadata?.telefon || user.user_metadata?.phone || cached?.telefon || '',
          email: user.email || cached?.email || ''
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('kineto_profile_cache', JSON.stringify(fullProfile));
          } catch (e) {}
        }
        return fullProfile;
      }
    } catch (err) {
      console.warn('Eroare la citirea profilului din Supabase:', err);
    }
  }

  if (cached) return cached;

  if (user) {
    return {
      id: user.id,
      display_name: user.user_metadata?.display_name || user.user_metadata?.name || '',
      username: user.user_metadata?.username || (user.email ? `@${user.email.split('@')[0]}` : ''),
      telefon: user.user_metadata?.telefon || user.user_metadata?.phone || '',
      email: user.email || ''
    };
  }

  return null;
}
