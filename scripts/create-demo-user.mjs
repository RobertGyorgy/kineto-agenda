/**
 * create-demo-user.mjs — Creează utilizatorul "Cont demo" în Supabase.
 * Rulare: node scripts/create-demo-user.mjs
 * Necesită în .env: PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (service role).
 *
 * Atenție: rulează o SINGURĂ dată. Dacă utilizatorul există deja, scriptul
 * îl afișează și se oprește.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import WS from 'ws';

// Polyfill WebSocket pentru Node 20 (realtime nu e folosit, dar clientul cere WS la construcție)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WS;
}

// Încarcă .env manual (fără dependență dotenv la runtime)
const env = {};
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@kineto-agenda.ro';

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await supabase.auth.admin.listUsers();
const found = existing?.users?.find((u) => u.email === DEMO_EMAIL);
if (found) {
  console.log('EXISTA deja:', found.id);
  process.exit(0);
}

// Generează o parolă aleatorie puternică (rămâne doar locală, în config.ts)
const password = crypto.randomUUID().replace(/-/g, '') + 'A1!';

const { data, error } = await supabase.auth.admin.createUser({
  email: DEMO_EMAIL,
  password,
  email_confirm: true,
  user_metadata: { display_name: 'Cont Demo', username: '@demo' },
});
if (error) {
  console.error('Eroare creare utilizator:', error.message);
  process.exit(1);
}
const userId = data.user.id;

// Rânduri inițiale în DB (setări + profil) — aplicația demo le servește
// ulterior DOAR din localStorage; acestea sunt doar valorile de pornire.
const { error: settingsErr } = await supabase.from('settings').insert({
  user_id: userId,
  therapist_name: 'Cont Demo',
  work_start: '08:00',
  work_end: '20:00',
  lunch_start: '12:00',
  lunch_end: '12:30',
  session_duration: 50,
  break_buffer: 10,
  zile_lucratoare: [1, 2, 3, 4, 5],
  default_price: 150,
  default_total_sessions: 10,
  categories: ['Belaqva', 'Ghimbav', 'Neachitați', 'Achitați'],
  active_categories: ['Belaqva', 'Ghimbav', 'Neachitați', 'Achitați'],
  lunch_breaks: {},
});
if (settingsErr) console.error('Eroare settings:', settingsErr.message);

const { error: profileErr } = await supabase.from('profiles').upsert(
  { id: userId, display_name: 'Cont Demo', username: '@demo', telefon: '', updated_at: new Date().toISOString() },
  { onConflict: 'id' }
);
if (profileErr) console.error('Eroare profiles:', profileErr.message);

console.log('Creat:', userId);
console.log('Parola (salveaz-o în src/lib/demo/config.ts):', password);
