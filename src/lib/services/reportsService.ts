/**
 * reportsService.ts — Date pentru ReportsView (statistici + rapoarte)
 * Folosit în: ReportsView.astro
 */
import { supabase, getCurrentUser } from '../supabase';
import type { IstericSaptamanal } from '../database.types';
import { toLocalISOString } from '../../utils/date';

interface PaymentRecord {
  pacient_id: string;
  suma: number;
  data_platii: string;
}

// ── Helper: preia toate plățile reale (din tabela `plati` + pacienți marcați `achitat: true`) ──
async function fetchAllEffectivePayments(startStr?: string, endStr?: string): Promise<PaymentRecord[]> {
  try {
    const user = await getCurrentUser();
    let platiQuery = (supabase as any).from('plati').select('pacient_id, suma, data_platii').eq('user_id', user.id);
    if (startStr) platiQuery = platiQuery.gte('data_platii', startStr);
    if (endStr)   platiQuery = platiQuery.lte('data_platii', endStr);

    const { data: platiData } = await platiQuery;
    const allPayments: PaymentRecord[] = (platiData || []).map((p: any) => ({
      pacient_id: p.pacient_id,
      suma: Number(p.suma || 0),
      data_platii: (p.data_platii || '').split('T')[0]
    }));

    // Căutăm pacienții cu `achitat = true` care nu au încă rânduri în tabela `plati`
    const patientsWithPlati = new Set(allPayments.map(p => p.pacient_id));

    let patientsQuery = (supabase as any)
      .from('pacienti')
      .select('id, cost, created_at, achitat')
      .eq('achitat', true)
      .eq('user_id', user.id);

    if (startStr) patientsQuery = patientsQuery.gte('created_at', startStr);
    if (endStr)   patientsQuery = patientsQuery.lte('created_at', endStr + 'T23:59:59');

    const { data: patientsData } = await patientsQuery;
    (patientsData || []).forEach((p: any) => {
      if (!patientsWithPlati.has(p.id) && Number(p.cost || 0) > 0) {
        allPayments.push({
          pacient_id: p.id,
          suma: Number(p.cost || 0),
          data_platii: (p.created_at || '').split('T')[0]
        });
      }
    });

    return allPayments;
  } catch (e) {
    console.error('Eroare fetchAllEffectivePayments:', e);
    return [];
  }
}

// ── Statistici pentru AZI ─────────────────────────────────────
export async function getTodayStats(date?: string) {
  const now = new Date();
  const todayStr = toLocalISOString(now);
  const targetDate = date ?? todayStr;
  const user = await getCurrentUser();

  const { data: programariData, error: programariError } = await supabase
    .from('programari')
    .select('status, ora, data, pacient_id, pacienti(cost, achitat, sedinte_total)')
    .eq('data', targetDate)
    .eq('user_id', user.id);

  if (programariError) throw new Error('Eroare la citirea programărilor zilnice: ' + programariError.message);

  const effectivePayments = await fetchAllEffectivePayments(targetDate, targetDate);
  const progList = (programariData || []) as any[];

  const sedinte_total = progList.length;
  const finalizate = progList.filter(p => p.status === 'finalizat' || p.status === 'finalizata').length;
  const absente = progList.filter(p => p.status === 'absent').length;

  let venit_azi = effectivePayments.reduce((sum, p) => sum + Number(p.suma || 0), 0);

  return { sedinte_total, finalizate, absente, venit_azi: Math.round(venit_azi), data: targetDate };
}

// ── Statistici SĂPTĂMÂNALE (Luni - Duminică) ─────────────────────
export async function getWeekStats(baseDate?: string) {
  const realNow = new Date();
  const refDate = baseDate ? new Date(baseDate) : realNow;

  const day = refDate.getDay(); // 0 = Duminică, 1 = Luni...
  const distanceToMonday = (day === 0 ? -6 : 1) - day;

  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + distanceToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = toLocalISOString(monday);
  const endStr = toLocalISOString(sunday);

  const user = await getCurrentUser();

  const { data: programariData, error: programariError } = await supabase
    .from('programari')
    .select('data, ora, status, pacient_id, pacienti(cost, sedinte_total, achitat)')
    .gte('data', startStr)
    .lte('data', endStr)
    .eq('user_id', user.id);

  if (programariError) throw new Error('Eroare la citirea programărilor săptămânale: ' + programariError.message);

  const effectivePayments = await fetchAllEffectivePayments(startStr, endStr);
  const progList = (programariData || []) as any[];

  const byDay: Record<string, { finalizate: number; absente: number; venit: number }> = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalISOString(d);
    byDay[dateStr] = { finalizate: 0, absente: 0, venit: 0 };
  }

  progList.forEach((p: any) => {
    if (!byDay[p.data]) byDay[p.data] = { finalizate: 0, absente: 0, venit: 0 };
    const isDone = p.status === 'finalizat' || p.status === 'finalizata';
    if (isDone) byDay[p.data].finalizate++;
    if (p.status === 'absent') byDay[p.data].absente++;
  });

  // Distribuim plățile reale pe zilele exacte
  effectivePayments.forEach(p => {
    if (p.data_platii && byDay[p.data_platii]) {
      byDay[p.data_platii].venit += p.suma;
    }
  });

  const total = progList.length;
  const finalizate = Object.values(byDay).reduce((sum, d) => sum + d.finalizate, 0);
  const absente = Object.values(byDay).reduce((sum, d) => sum + d.absente, 0);
  const venit = Object.values(byDay).reduce((sum, d) => sum + d.venit, 0);
  const prezenta = total > 0 ? Math.round((finalizate / total) * 100) : 0;

  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const chartData = labels.map((lbl, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalISOString(d);
    const dayNameFull = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
    const capTitle = dayNameFull.charAt(0).toUpperCase() + dayNameFull.slice(1);
    return { 
      label: lbl, 
      val: Math.round(byDay[dateStr]?.venit || 0), 
      dateStr,
      startDateStr: dateStr,
      endDateStr: dateStr,
      fullTitle: capTitle
    };
  });

  return { total, finalizate, absente, venit: Math.round(venit), prezenta, chartData, startStr, endStr };
}

// ── Statistici LUNARE ─────────────────────────────────────────
export async function getMonthStats(baseDate?: string) {
  const realNow = new Date();
  const refDate = baseDate ? new Date(baseDate) : realNow;

  const startStr = toLocalISOString(new Date(refDate.getFullYear(), refDate.getMonth(), 1));
  const endStr = toLocalISOString(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0));
  const user = await getCurrentUser();

  const { data: programariData, error: programariError } = await supabase
    .from('programari')
    .select('data, ora, status, pacienti(cost, sedinte_total, achitat)')
    .gte('data', startStr)
    .lte('data', endStr)
    .eq('user_id', user.id);

  if (programariError) throw new Error('Eroare la citirea programărilor lunare: ' + programariError.message);

  const effectivePayments = await fetchAllEffectivePayments(startStr, endStr);
  const progList = (programariData || []) as any[];

  const total = progList.length;
  const finalizate = progList.filter(p => p.status === 'finalizat' || p.status === 'finalizata').length;
  const absente = progList.filter(p => p.status === 'absent').length;

  let venit = effectivePayments.reduce((sum, p) => sum + Number(p.suma || 0), 0);

  const byPeriod = [0, 0, 0, 0];
  effectivePayments.forEach(p => {
    if (!p.data_platii) return;
    const parts = p.data_platii.split('-');
    const d = parseInt(parts[2], 10);
    if (!isNaN(d)) {
      let idx = Math.floor((d - 1) / 8);
      if (idx > 3) idx = 3;
      byPeriod[idx] += p.suma;
    }
  });

  const chartData = byPeriod.map((val, i) => {
    const startDay = i * 8 + 1;
    const lastDayOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
    const endDay = i === 3 ? lastDayOfMonth : (i + 1) * 8;
    const dStart = new Date(refDate.getFullYear(), refDate.getMonth(), startDay);
    const dEnd = new Date(refDate.getFullYear(), refDate.getMonth(), endDay);
    const monthName = refDate.toLocaleDateString('ro-RO', { month: 'long' });
    return { 
      label: `S${i+1}`, 
      val: Math.round(val), 
      dateStr: toLocalISOString(dStart),
      startDateStr: toLocalISOString(dStart),
      endDateStr: toLocalISOString(dEnd),
      fullTitle: `Săptămâna ${i+1} (${startDay} - ${endDay} ${monthName})`
    };
  });

  return { total, finalizate, absente, venit: Math.round(venit), chartData, startStr, endStr };
}

// ── Statistici TRIMESTRIALE ───────────────────────────────────
export async function getQuarterStats(baseDate?: string) {
  const realNow = new Date();
  const refDate = baseDate ? new Date(baseDate) : realNow;
  const currentQuarter = Math.floor(refDate.getMonth() / 3);
  const startStr = toLocalISOString(new Date(refDate.getFullYear(), currentQuarter * 3, 1));
  const endStr = toLocalISOString(new Date(refDate.getFullYear(), currentQuarter * 3 + 3, 0));
  const user = await getCurrentUser();

  const { data: programariData, error: programariError } = await supabase
    .from('programari')
    .select('data, ora, status, pacienti(cost, sedinte_total, achitat)')
    .gte('data', startStr)
    .lte('data', endStr)
    .eq('user_id', user.id);

  if (programariError) throw new Error('Eroare la citirea programărilor trimestriale: ' + programariError.message);

  const effectivePayments = await fetchAllEffectivePayments(startStr, endStr);
  const progList = (programariData || []) as any[];

  const total = progList.length;
  const finalizate = progList.filter(p => p.status === 'finalizat' || p.status === 'finalizata').length;
  const absente = progList.filter(p => p.status === 'absent').length;

  let venit = effectivePayments.reduce((sum, p) => sum + Number(p.suma || 0), 0);

  const byMonth = [0, 0, 0];
  effectivePayments.forEach(p => {
    if (!p.data_platii) return;
    const parts = p.data_platii.split('-');
    const m = (parseInt(parts[1], 10) - 1) % 3;
    if (!isNaN(m) && m >= 0 && m < 3) {
      byMonth[m] += p.suma;
    }
  });

  const monthNames = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = byMonth.map((val, i) => {
    const mIdx = currentQuarter * 3 + i;
    const dStart = new Date(refDate.getFullYear(), mIdx, 1);
    const dEnd = new Date(refDate.getFullYear(), mIdx + 1, 0);
    const monthName = dStart.toLocaleDateString('ro-RO', { month: 'long' });
    return { 
      label: monthNames[mIdx], 
      val: Math.round(val), 
      dateStr: toLocalISOString(dStart),
      startDateStr: toLocalISOString(dStart),
      endDateStr: toLocalISOString(dEnd),
      fullTitle: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${refDate.getFullYear()}`
    };
  });

  return { total, finalizate, absente, venit: Math.round(venit), chartData, startStr, endStr };
}

// ── Statistici ANUALE ─────────────────────────────────────────
export async function getYearStats(baseDate?: string) {
  const realNow = new Date();
  const refDate = baseDate ? new Date(baseDate) : realNow;
  const startStr = toLocalISOString(new Date(refDate.getFullYear(), 0, 1));
  const endStr = toLocalISOString(new Date(refDate.getFullYear(), 12, 0));
  const user = await getCurrentUser();

  const { data: programariData, error: programariError } = await supabase
    .from('programari')
    .select('data, ora, status, pacienti(cost, sedinte_total, achitat)')
    .gte('data', startStr)
    .lte('data', endStr)
    .eq('user_id', user.id);

  if (programariError) throw new Error('Eroare la citirea programărilor anuale: ' + programariError.message);

  const effectivePayments = await fetchAllEffectivePayments(startStr, endStr);
  const progList = (programariData || []) as any[];

  const total = progList.length;
  const finalizate = progList.filter(p => p.status === 'finalizat' || p.status === 'finalizata').length;
  const absente = progList.filter(p => p.status === 'absent').length;

  let venit = effectivePayments.reduce((sum, p) => sum + Number(p.suma || 0), 0);

  const byMonth = Array(12).fill(0);
  effectivePayments.forEach(p => {
    if (!p.data_platii) return;
    const parts = p.data_platii.split('-');
    const m = parseInt(parts[1], 10) - 1;
    if (!isNaN(m) && m >= 0 && m < 12) {
      byMonth[m] += p.suma;
    }
  });

  const initialLetters = ['I', 'F', 'M', 'A', 'M', 'I', 'I', 'A', 'S', 'O', 'N', 'D'];
  const chartData = byMonth.map((val, i) => {
    const dStart = new Date(refDate.getFullYear(), i, 1);
    const dEnd = new Date(refDate.getFullYear(), i + 1, 0);
    const monthName = dStart.toLocaleDateString('ro-RO', { month: 'long' });
    return { 
      label: initialLetters[i], 
      val: Math.round(val), 
      dateStr: toLocalISOString(dStart),
      startDateStr: toLocalISOString(dStart),
      endDateStr: toLocalISOString(dEnd),
      fullTitle: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${refDate.getFullYear()}`
    };
  });

  return { total, finalizate, absente, venit: Math.round(venit), chartData, startStr, endStr };
}

// ── Detalii încasări pentru o zi sau o perioadă ───────────────
export interface DetailedPayment {
  id: string;
  pacientId: string;
  numeComplet: string;
  telefon?: string;
  suma: number;
  dataPlatii: string;
  oraPlatii?: string;
  metoda: string;
  plan?: string;
  locatie?: string;
}

export async function getDetailedPayments(startStr: string, endStr?: string): Promise<DetailedPayment[]> {
  const endDate = endStr || startStr;
  try {
    const user = await getCurrentUser();
    const { data: platiData, error: platiErr } = await (supabase as any)
      .from('plati')
      .select('id, pacient_id, suma, data_platii, metoda, created_at, pacienti(id, nume, prenume, telefon, plan, locatie)')
      .gte('data_platii', startStr)
      .lte('data_platii', endDate)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (platiErr) {
      console.warn('Eroare citire plati:', platiErr);
    }

    const results: DetailedPayment[] = [];
    const patientIdsWithPlati = new Set<string>();

    (platiData || []).forEach((p: any) => {
      patientIdsWithPlati.add(p.pacient_id);
      const pacient = p.pacienti || {};
      const numeComplet = `${pacient.prenume || ''} ${pacient.nume || ''}`.trim() || 'Pacient';
      
      let ora = '';
      if (p.created_at) {
        try {
          const dt = new Date(p.created_at);
          ora = dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        } catch (_) {}
      }

      results.push({
        id: p.id || `plati-${Math.random()}`,
        pacientId: p.pacient_id,
        numeComplet,
        telefon: pacient.telefon || '',
        suma: Number(p.suma || 0),
        dataPlatii: p.data_platii,
        oraPlatii: ora,
        metoda: p.metoda || 'Plată',
        plan: pacient.plan || '',
        locatie: pacient.locatie || ''
      });
    });

    // Căutăm și pacienții cu achitat = true creați în acest interval dacă nu au rând în plati
    const { data: pacientiData } = await (supabase as any)
      .from('pacienti')
      .select('id, nume, prenume, telefon, plan, locatie, cost, created_at, achitat')
      .eq('achitat', true)
      .eq('user_id', user.id)
      .gte('created_at', startStr)
      .lte('created_at', endDate + 'T23:59:59');

    (pacientiData || []).forEach((p: any) => {
      if (!patientIdsWithPlati.has(p.id) && Number(p.cost || 0) > 0) {
        const numeComplet = `${p.prenume || ''} ${p.nume || ''}`.trim() || 'Pacient';
        let ora = '';
        if (p.created_at) {
          try {
            const dt = new Date(p.created_at);
            ora = dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
          } catch (_) {}
        }

        results.push({
          id: `pacient-cost-${p.id}`,
          pacientId: p.id,
          numeComplet,
          telefon: p.telefon || '',
          suma: Number(p.cost || 0),
          dataPlatii: (p.created_at || '').split('T')[0],
          oraPlatii: ora,
          metoda: 'Pachet achitat',
          plan: p.plan || '',
          locatie: p.locatie || ''
        });
      }
    });

    return results;
  } catch (err) {
    console.error('Eroare getDetailedPayments:', err);
    return [];
  }
}

// ── Programări detaliate pentru popups ────────────────────────
export async function getDetailedSessions(startStr: string, endStr?: string, statusFilter?: 'absent' | 'all') {
  const endDate = endStr || startStr;
  try {
    const user = await getCurrentUser();
    let query = supabase
      .from('programari')
      .select('id, data, ora, status, pacienti(id, nume, prenume)')
      .gte('data', startStr)
      .lte('data', endDate)
      .eq('user_id', user.id)
      .order('data', { ascending: false })
      .order('ora', { ascending: false });
      
    if (statusFilter === 'absent') {
      query = query.eq('status', 'absent');
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Eroare citire programari detailed:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      data: p.data,
      ora: p.ora,
      status: p.status,
      pacientId: p.pacienti?.id,
      numeComplet: `${p.pacienti?.prenume || ''} ${p.pacienti?.nume || ''}`.trim() || 'Pacient'
    }));
  } catch (err) {
    console.error('Eroare getDetailedSessions:', err);
    return [];
  }
}

// ── Pacienți neachitați ───────────────────────────────────────
export async function getUnpaidPatients(startStr?: string, endStr?: string) {
  let query = supabase
    .from('pacienti_view')
    .select('id, name, cost, achitat, suma_incasata, created_at');

  if (startStr) query = query.gte('created_at', startStr);
  if (endStr) query = query.lte('created_at', endStr + 'T23:59:59');

  const { data: rawPatients, error: pErr } = await query;

  if (pErr) throw new Error('Eroare la citirea pacienților neachitați: ' + pErr.message);

  const patientsList = (rawPatients || []) as any[];
  const unpaidPatients: any[] = [];
  let totalDatorat = 0;

  patientsList.forEach(p => {
    const cost = Number(p.cost || 0);
    const paid = Number(p.suma_incasata || 0);
    const isFullyPaid = p.achitat === true || (cost > 0 && paid >= cost);

    if (!isFullyPaid) {
      const rest = Math.max(0, cost - paid);
      unpaidPatients.push({
        ...p,
        name: p.name,
        suma_restanta: rest > 0 ? rest : cost
      });
      totalDatorat += rest > 0 ? rest : cost;
    }
  });

  return { count: unpaidPatients.length, totalRON: totalDatorat, patients: unpaidPatients };
}

// ── Istoricul săptămânal ──────────────────────────────────────
export async function getWeeklyHistory(limit = 8): Promise<IstericSaptamanal[]> {
  const { data, error } = await supabase
    .from('istoric_saptamanal')
    .select('*')
    .order('saptamana_start', { ascending: false })
    .limit(limit);

  if (error) throw new Error('Eroare la citirea istoricului: ' + error.message);
  return data ?? [];
}

// ── Arhivare manuală ──────────────────────────────────────────
export async function recalculateWeek(startDate?: string) {
  const { error } = await (supabase as any).rpc('arhiveaza_saptamana', {
    saptamana_start: startDate ?? null
  } as any);

  if (error) throw new Error('Eroare la arhivarea săptămânii: ' + error.message);
}