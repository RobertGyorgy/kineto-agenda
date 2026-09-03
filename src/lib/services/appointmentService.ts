/**
 * appointmentService.ts — CRUD programări Supabase
 * Folosit în: AddSessionSheet.astro, SessionWrapUpSheet.astro, calendar.astro
 */
import { supabase, getCurrentUser } from '../supabase';
import type { Programare, ProgramareInsert } from '../database.types';
import { getSettings } from './settingsService';
import { toLocalISOString } from '../../utils/date';

// ── Citire programare unică (editare) ─────────────────────────
export async function getAppointment(id: string): Promise<Programare & { pacienti: any }> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('programari')
    .select(`
      *,
      pacienti (
        id,
        prenume,
        nume,
        telefon,
        locatie,
        plan,
        sedinte_folosite,
        sedinte_total,
        achitat,
        cost,
        drive_link
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) throw new Error('Eroare la citirea programării: ' + error.message);
  return data as any;
}

// ── Ștergere programare ───────────────────────────────────────
export async function deleteAppointment(id: string) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('programari')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error('Eroare la ștergerea programării: ' + error.message);
}

// ── Actualizare programare existentă ──────────────────────────
export async function updateAppointment(id: string, updates: {
  pacient_id?: string;
  data?: string;
  ora?: string;
  locatie?: 'Belaqva' | 'Ghimbav';
  group_id?: string | null;
}) {
  if (updates.data) {
    const d = new Date(updates.data + 'T00:00:00');
    if (d.getDay() === 0 || d.getDay() === 6) {
      throw new Error('Nu se pot muta programări în weekend (Sâmbătă sau Duminică).');
    }
  }
  const user = await getCurrentUser();
  const { error } = await (supabase as any)
    .from('programari')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('updateAppointment error:', error, { id, updates });
    throw new Error('Eroare la actualizarea programării: ' + (error.message || JSON.stringify(error)));
  }
}

// ── Schimbă pacienții între două programări (swap) ─────────────
export async function swapAppointmentPatients(idA: string, idB: string) {
  const [{ data: a, error: errA }, { data: b, error: errB }] = await Promise.all([
    (supabase as any).from('programari').select('pacient_id').eq('id', idA).single(),
    (supabase as any).from('programari').select('pacient_id').eq('id', idB).single(),
  ]);

  if (errA || errB || !a || !b) {
    throw new Error('Eroare la citirea programărilor pentru schimb.');
  }

  const pacientA = a.pacient_id;
  const pacientB = b.pacient_id;

  try {
    const { error: updA } = await (supabase as any)
      .from('programari')
      .update({ pacient_id: pacientB })
      .eq('id', idA);
    if (updA) throw updA;

    const { error: updB } = await (supabase as any)
      .from('programari')
      .update({ pacient_id: pacientA })
      .eq('id', idB);
    if (updB) {
      // Rollback best-effort
      await (supabase as any).from('programari').update({ pacient_id: pacientA }).eq('id', idA);
      throw updB;
    }
  } catch (err: any) {
    console.error('swapAppointmentPatients error:', err, { idA, idB });
    throw new Error('Eroare la schimbul pacienților: ' + (err.message || JSON.stringify(err)));
  }
}

// ── Programări pentru o zi specifică (calendar zilnic) ────────
export async function getAppointmentsByDate(date: string): Promise<Programare[]> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('programari')
    .select(`
      *,
      pacienti ( prenume, nume, telefon, locatie, status_abonament, sedinte_folosite, sedinte_total, achitat, cost )
    `)
    .eq('data', date)
    .eq('user_id', user.id)
    .order('ora', { ascending: true });

  if (error) throw new Error('Eroare la citirea programărilor: ' + error.message);
  return data ?? [];
}

// ── Programări pentru un interval de date (calendar săptămânal) 
export async function getAppointmentsByRange(startDate: string, endDate: string): Promise<Programare[]> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('programari')
    .select(`
      *,
      pacienti ( prenume, nume, telefon, locatie )
    `)
    .gte('data', startDate)
    .lte('data', endDate)
    .eq('user_id', user.id)
    .order('data', { ascending: true })
    .order('ora',  { ascending: true });

  if (error) throw new Error('Eroare la citirea programărilor: ' + error.message);
  return data ?? [];
}

// ── Toate programările unui pacient ───────────────────────────
export async function getAppointmentsByPatient(patientId: string): Promise<Programare[]> {
  const { data, error } = await supabase
    .from('programari')
    .select('*')
    .eq('pacient_id', patientId)
    .order('data', { ascending: false });

  if (error) throw new Error('Eroare la citirea programărilor pacientului: ' + error.message);
  return data ?? [];
}

// ── Creare programare nouă (AddSessionSheet) ──────────────────
// Triggerul `valideaza_programare` rulează automat în DB
export async function createAppointment(input: {
  pacient_id: string;
  data:       string;   // "YYYY-MM-DD"
  ora:        string;   // "HH:MM"
  locatie?:   'Belaqva' | 'Ghimbav';
  group_id?:  string | null;
}): Promise<string> { // returnează ID-ul programării
  const d = new Date(input.data + 'T00:00:00');
  if (d.getDay() === 0 || d.getDay() === 6) {
    throw new Error('Nu se pot crea programări în weekend (Sâmbătă sau Duminică).');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Trebuie să fii autentificat pentru a crea o programare.');

  const payload: ProgramareInsert = {
    pacient_id: input.pacient_id,
    user_id:    user.id,
    data:       input.data,
    ora:        input.ora,
    locatie:    input.locatie ?? 'Belaqva',
    status:     'programat',
    group_id:   input.group_id ?? null,
  };

  const { data, error } = await (supabase as any)
    .from('programari')
    .insert(payload)
    .select('id')
    .single();

  // Eroarea din trigger conține mesajul descriptiv în română
  if (error) {
    console.error('createAppointment error:', error, { payload });
    throw new Error(error.message || 'Eroare la crearea programării');
  }

  return data.id;
}

export async function completeSession(id: string, note?: string) {
  // DB triggerul `trg_incrementeaza_sedinte` incrementează automat sedinte_folosite
  // când statusul devine 'finalizat'.
  const user = await getCurrentUser();
  const { error } = await (supabase as any)
    .from('programari')
    .update({ status: 'finalizat', note: note ?? null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('completeSession error:', error, { id });
    throw new Error('Eroare la finalizarea sesiunii: ' + (error.message || JSON.stringify(error)));
  }
}

// ── Marcare absent ────────────────────────────────────────────
export async function markAbsent(id: string, motiv?: string) {
  const user = await getCurrentUser();
  const { error } = await (supabase as any)
    .from('programari')
    .update({ status: 'absent', motiv: motiv ?? null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('markAbsent error:', error, { id });
    throw new Error('Eroare la marcarea absenței: ' + (error.message || JSON.stringify(error)));
  }
}

// ── Anulare programare ────────────────────────────────────────
export async function cancelAppointment(id: string, motiv?: string) {
  const user = await getCurrentUser();
  const { error } = await (supabase as any)
    .from('programari')
    .update({ status: 'anulat', motiv: motiv ?? null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('cancelAppointment error:', error, { id });
    throw new Error('Eroare la anularea programării: ' + (error.message || JSON.stringify(error)));
  }
}

// ── Reprogramare (rebook next week din WrapUp) ────────────────
export async function rebookNextWeek(originalId: string): Promise<string> {
  const user = await getCurrentUser();
  const { data: orig, error: fetchErr } = await (supabase as any)
    .from('programari')
    .select('pacient_id, data, ora, locatie')
    .eq('id', originalId)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !orig) throw new Error('Programarea originală nu a fost găsită.');

  // Calculăm data săptămânii viitoare (folosind fusul orar local)
  const nextDate = new Date(orig.data + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 7);
  const nextDateStr = toLocalISOString(nextDate);

  return createAppointment({
    pacient_id: orig.pacient_id,
    data:       nextDateStr,
    ora:        orig.ora,
    locatie:    orig.locatie as 'Belaqva' | 'Ghimbav',
  });
}

// ── Wrap-up: sesiuni trecute încă nerezolvate ─────────────────
// (status 'programat', data trecută sau azi dar ora + 1h a trecut)
export interface PendingWrapUp {
  id: string;
  pacient_id: string;
  data: string;
  ora: string;
  pacienti: { prenume: string; nume: string } | null;
}

export async function getPendingWrapUps(): Promise<PendingWrapUp[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const { data, error } = await (supabase as any)
    .from('programari')
    .select(`
      id, pacient_id, data, ora,
      pacienti ( prenume, nume )
    `)
    .eq('user_id', user.id)
    .eq('status', 'programat')
    .lte('data', todayStr)
    .order('data', { ascending: true })
    .order('ora',  { ascending: true });

  if (error) throw new Error('Eroare la citirea sesiunilor de confirmat: ' + error.message);

  const settings = await getSettings();
  const sessionDuration = settings?.session_duration || 50;

  return (data ?? []).filter((a: PendingWrapUp) => {
    // Orice zi din trecut este automat pending.
    if (a.data < todayStr) return true;

    // Pentru ziua curentă, sesiunea este pending dacă s-a terminat (ora + session_duration min).
    const [h, m] = (a.ora || '00:00').split(':').map(Number);
    const endMinutes = h * 60 + m + sessionDuration;
    return endMinutes <= currentMinutes;
  });
}

// ── Câte programări are pacientul în săptămâna datei (L–D) ────
export async function countPatientWeekAppointments(patientId: string, dateStr: string): Promise<number> {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0 = Duminică
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (x: Date) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');

  const { count, error } = await (supabase as any)
    .from('programari')
    .select('id', { count: 'exact', head: true })
    .eq('pacient_id', patientId)
    .gte('data', fmt(monday))
    .lte('data', fmt(sunday))
    .not('status', 'in', '("anulat","absent")');

  if (error) throw new Error('Eroare la numărarea programărilor săptămânale: ' + error.message);
  return count ?? 0;
}

