/**
 * localDb.ts — Bază de date locală (localStorage) pentru contul demo.
 *
 * Cât timp este autentificat contul demo, TOATE operațiunile pe
 * `supabase.from(...)` / `supabase.rpc(...)` sunt servite de aici în loc de
 * PostgREST. Datele reale din Supabase rămân neschimbate (și orice scriere
 * directă e blocată de triggerul `trg_blocheaza_demo`).
 *
 * Emulează:
 *  - tabelele folosite de aplicație + view-ul `pacienti_view`
 *  - filtre (eq, neq, gt/gte/lt/lte, in, not-in, is, or, ilike), order, limit
 *  - select cu coloane + embeds (`pacienti (...)` pe programari/plati)
 *  - insert / update / upsert / delete cu `select().single()/maybeSingle()`
 *  - count exact cu `head: true`
 *  - triggerul `trg_incrementeaza_sedinte` (finalizat → +1 sedinte_folosite)
 *  - triggerul de status abonament (activ / ultima_sedinta / terminat)
 *  - rpc('arhiveaza_saptamana')
 */
import { DEMO_USER_ID } from './config';

// ── Persistență ───────────────────────────────────────────────

const STORAGE_KEY = `kineto_demo_db_v1_${DEMO_USER_ID}`;

interface DemoStore {
  seededAt: string;
  tables: Record<string, any[]>;
}

export function loadStore(): DemoStore {
  let store: DemoStore | undefined;
  let fresh = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tables) store = parsed;
    }
  } catch { /* ignore */ }
  if (!store) {
    store = seedStore();
    fresh = true;
  }
  // Autoprogramare: completează programările lipsă pentru următoarele 2 săptămâni
  const changed = autoSchedule(store);
  if (changed || fresh) saveStore(store);
  return store;
}

export function saveStore(store: DemoStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore quota errors */ }
}

// ── Utilitare ─────────────────────────────────────────────────

const uuid = () =>
  (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

export function computeSubscriptionStatus(p: any): string {
  const ramase = Math.max(0, (p.sedinte_total ?? 0) - (p.sedinte_folosite ?? 0));
  if (ramase <= 0) return 'terminat';
  if (ramase === 1) return 'ultima_sedinta';
  return 'activ';
}

function withDerivedPacientiFields(p: any) {
  const ramase = Math.max(0, (p.sedinte_total ?? 0) - (p.sedinte_folosite ?? 0));
  return { ...p, sedinte_ramase: ramase, status_abonament: computeSubscriptionStatus(p) };
}

/** Construiește rândurile view-ului pacienti_view din tabelele de bază. */
function buildPacientiView(store: DemoStore): any[] {
  const plati = store.tables['plati'] || [];
  const programari = store.tables['programari'] || [];
  return (store.tables['pacienti'] || []).map((p) => {
    const suma = plati.filter((pl) => pl.pacient_id === p.id).reduce((s, pl) => s + (pl.suma || 0), 0);
    const numarProg = programari.filter((pr) => pr.pacient_id === p.id).length;
    const name = `${(p.prenume || '').trim()} ${(p.nume || '').trim()}`.trim();
    return { ...p, name, suma_incasata: suma, total_incasat: suma, numar_programari: numarProg };
  });
}

/** Rândurile unei "tabele" (inclusiv view-uri). */
export function tableRows(store: DemoStore, table: string): any[] {
  if (table === 'pacienti_view') return buildPacientiView(store);
  return store.tables[table] || [];
}

// ── Emulare trigger-e ─────────────────────────────────────────

function applyProgramariTrigger(store: DemoStore, op: 'INSERT' | 'UPDATE' | 'DELETE', oldRow: any, newRow: any) {
  const pacienti = store.tables['pacienti'] || [];
  const bump = (pacientId: string, delta: number) => {
    const p = pacienti.find((x) => x.id === pacientId);
    if (!p) return;
    p.sedinte_folosite = Math.min(Math.max(0, (p.sedinte_folosite ?? 0) + delta), p.sedinte_total ?? 0);
    Object.assign(p, withDerivedPacientiFields(p));
    p.updated_at = new Date().toISOString();
  };
  const wasFinal = (r: any) => r && r.status === 'finalizat';
  if (op === 'INSERT') {
    if (wasFinal(newRow)) bump(newRow.pacient_id, +1);
  } else if (op === 'UPDATE') {
    if (wasFinal(newRow) && !wasFinal(oldRow)) bump(newRow.pacient_id, +1);
    if (!wasFinal(newRow) && wasFinal(oldRow)) bump(oldRow.pacient_id, -1);
  } else {
    if (wasFinal(oldRow)) bump(oldRow.pacient_id, -1);
  }
}

function applyPacientiDerived(row: any) {
  Object.assign(row, withDerivedPacientiFields(row));
}

// ── Motor de interogare ───────────────────────────────────────

type Op = { name: string; args: any[] };

interface ExecResult {
  data: any;
  error: any;
  count?: number | null;
}

export function runDemoQuery(table: string, ops: Op[], mode: 'all' | 'single' | 'maybeSingle'): ExecResult {
  const store = loadStore();
  const selectOp = ops.find((o) => o.name === 'select');
  const countOnly = !!selectOp && selectOp.args[1]?.count === 'exact' && selectOp.args[1]?.head === true;
  const selectStr: string | undefined = selectOp ? (selectOp.args[0] ?? '*') : undefined;

  const mutation = ops.find((o) => ['insert', 'update', 'upsert', 'delete'].includes(o.name));
  let affected: any[] = [];

  if (mutation) {
    affected = applyMutation(store, table, ops);
    saveStore(store);
  }

  // Sursa rândurilor: rezultatul mutației sau citire din "tabel"
  let rows = mutation ? affected.map((r) => ({ ...r })) : tableRows(store, table).map((r) => ({ ...r }));

  // Filtre
  const filters = ops.filter((o) => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not', 'is', 'or', 'ilike', 'like'].includes(o.name));
  for (const f of filters) rows = rows.filter((r) => matchesFilter(r, f));

  const count = rows.length;
  if (countOnly) return { data: null, error: null, count };

  // Order + limit
  for (const o of ops.filter((x) => x.name === 'order')) {
    const [col, opts] = o.args;
    const asc = opts?.ascending !== false;
    rows = [...rows].sort((a, b) => compareValues(a?.[col], b?.[col]) * (asc ? 1 : -1));
  }
  const limitOp = ops.find((o) => o.name === 'limit');
  if (limitOp) rows = rows.slice(0, limitOp.args[0]);

  // Proiecție (coloane + embeds)
  let data: any = rows.map((r) => projectRow(store, table, r, selectStr));

  if (mode === 'single') {
    if (data.length !== 1) {
      return { data: null, error: { message: data.length === 0 ? 'Row not found' : 'Multiple rows returned' }, count };
    }
    data = data[0];
  } else if (mode === 'maybeSingle') {
    data = data.length > 0 ? data[0] : null;
  }

  return { data, error: null, count };
}

function compareValues(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matchesFilter(row: any, f: Op): boolean {
  const [col, ...rest] = f.args;
  const val = row?.[col];
  switch (f.name) {
    case 'eq': return val === rest[0] || String(val) === String(rest[0]);
    case 'neq': return !(val === rest[0] || String(val) === String(rest[0]));
    case 'gt': return val > rest[0];
    case 'gte': return val >= rest[0];
    case 'lt': return val < rest[0];
    case 'lte': return val <= rest[0];
    case 'in': return (rest[0] as any[]).some((x) => x === val || String(x) === String(val));
    case 'is': return rest[0] === null ? val == null : val != null;
    case 'ilike':
    case 'like': {
      const pattern = String(rest[0]);
      const rx = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', f.name === 'ilike' ? 'i' : '');
      return rx.test(String(val ?? ''));
    }
    case 'not': {
      // Folosit ca .not('status', 'in', '("anulat","absent")')
      if (String(rest[0]).toLowerCase() === 'in') {
        const list = parseListLiteral(rest[1]);
        return !list.some((x) => x === val || String(x) === String(val));
      }
      return true;
    }
    case 'or': {
      // Folosit ca .or('name.ilike.Ana Popa,name.ilike.Popa Ana')
      const conds = String(f.args[0]).split(',').map((s) => {
        const m = s.match(/^(\w+)\.(ilike|like|eq)\.(.+)$/);
        return m ? { col: m[1], op: m[2], val: m[3] } : null;
      }).filter(Boolean) as any[];
      return conds.some((c) => matchesFilter(row, { name: c.op === 'eq' ? 'eq' : c.op, args: [c.col, c.val] } as Op));
    }
    default: return true;
  }
}

function parseListLiteral(lit: any): any[] {
  if (Array.isArray(lit)) return lit;
  const m = String(lit).match(/^\((.*)\)$/);
  if (!m) return [lit];
  return m[1].split(',').map((s) => s.trim().replace(/^"|^'|"$|'$|\\"/g, '').replace(/\\"/g, '"'));
}

/** Proiecție: coloane directe + embeds tip `pacienti (a, b)`. */
function projectRow(store: DemoStore, table: string, row: any, selectStr?: string): any {
  if (!selectStr) return row;
  const embeds: { ref: string; cols: string[] | null }[] = [];
  let rest = selectStr.replace(/(\w+)\s*\(([^)]*)\)/g, (_m, ref: string, cols: string) => {
    const trimmed = cols.trim();
    embeds.push({ ref, cols: trimmed === '*' ? null : trimmed.split(',').map((c) => c.trim()).filter(Boolean) });
    return '';
  });
  const directCols = rest.split(',').map((c) => c.trim()).filter(Boolean);
  const star = directCols.includes('*') || (directCols.length === 0 && embeds.length === 0);

  const out: any = {};
  if (star) Object.assign(out, row);
  else for (const c of directCols) if (c in row) out[c] = row[c];

  for (const e of embeds) {
    const refTable = e.ref;
    const fkCol = `${refTable === 'pacienti' ? 'pacient' : refTable}_id`;
    const target = tableRows(store, refTable).find((x) => x.id === row[fkCol]) || null;
    out[refTable] = target
      ? (e.cols ? e.cols.reduce((acc: any, c) => { if (c in target) acc[c] = target[c]; return acc; }, {}) : { ...target })
      : null;
  }
  return out;
}

// ── Mutații ───────────────────────────────────────────────────

function applyMutation(store: DemoStore, table: string, ops: Op[]): any[] {
  const ensure = (t: string) => { if (!store.tables[t]) store.tables[t] = []; return store.tables[t]; };
  const filters = ops.filter((o) => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not', 'is', 'or', 'ilike', 'like'].includes(o.name));
  const targetRows = () => ensure(table).filter((r) => filters.every((f) => matchesFilter(r, f)));
  const now = new Date().toISOString();

  const insertDefaults = (t: string, row: any) => ({
    id: uuid(),
    created_at: now,
    user_id: DEMO_USER_ID,
    ...row,
  });

  const mut = ops.find((o) => ['insert', 'update', 'upsert', 'delete'].includes(o.name))!;
  const affected: any[] = [];

  if (mut.name === 'insert') {
    const values = Array.isArray(mut.args[0]) ? mut.args[0] : [mut.args[0]];
    for (const v of values) {
      const row = insertDefaults(table, { ...v });
      if (table === 'pacienti') applyPacientiDerived(row);
      ensure(table).push(row);
      if (table === 'programari') applyProgramariTrigger(store, 'INSERT', null, row);
      affected.push(row);
    }
  } else if (mut.name === 'update') {
    const patch = { ...mut.args[0] };
    for (const row of targetRows()) {
      const old = { ...row };
      Object.assign(row, patch);
      if (table === 'pacienti') { applyPacientiDerived(row); row.updated_at = now; }
      if (table === 'profiles' || table === 'settings') row.updated_at = now;
      if (table === 'programari') applyProgramariTrigger(store, 'UPDATE', old, row);
      affected.push(row);
    }
  } else if (mut.name === 'upsert') {
    const onConflict: string = mut.args[1]?.onConflict || 'id';
    const values = Array.isArray(mut.args[0]) ? mut.args[0] : [mut.args[0]];
    for (const v of values) {
      const keyVal = v?.[onConflict];
      const existing = keyVal != null ? ensure(table).find((r) => r[onConflict] === keyVal) : undefined;
      if (existing) {
        const old = { ...existing };
        Object.assign(existing, v);
        if (table === 'pacienti') { applyPacientiDerived(existing); existing.updated_at = now; }
        if (table === 'programari') applyProgramariTrigger(store, 'UPDATE', old, existing);
        affected.push(existing);
      } else {
        const row = insertDefaults(table, { ...v });
        if (table === 'pacienti') applyPacientiDerived(row);
        ensure(table).push(row);
        if (table === 'programari') applyProgramariTrigger(store, 'INSERT', null, row);
        affected.push(row);
      }
    }
  } else if (mut.name === 'delete') {
    const rows = targetRows();
    store.tables[table] = ensure(table).filter((r) => !rows.includes(r));
    for (const row of rows) {
      if (table === 'programari') applyProgramariTrigger(store, 'DELETE', row, null);
      affected.push(row);
    }
  }
  return affected;
}

// ── rpc('arhiveaza_saptamana') ────────────────────────────────

export function runDemoRpc(fn: string, args: any): ExecResult {
  if (fn !== 'arhiveaza_saptamana') {
    return { data: null, error: { message: `Funcția demo necunoscută: ${fn}` } };
  }
  const store = loadStore();
  const startParam: string | null = args?.saptamana_start ?? null;

  const today = new Date();
  let start: Date;
  if (startParam) {
    start = new Date(startParam + 'T00:00:00');
  } else {
    // Lunea săptămânii curente
    start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sStart = dateStr(start);
  const sEnd = dateStr(end);

  const programari = (store.tables['programari'] || []).filter((p) => p.data >= sStart && p.data <= sEnd);
  const pacienti = store.tables['pacienti'] || [];
  const finalizate = programari.filter((p) => p.status === 'finalizat');
  const absente = programari.filter((p) => p.status === 'absent');
  const anulate = programari.filter((p) => p.status === 'anulat');
  const venit = finalizate.reduce((s, p) => {
    const pac = pacienti.find((x) => x.id === p.pacient_id);
    return s + (pac?.cost ?? 0);
  }, 0);

  const week = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    saptamana_start: sStart,
    saptamana_end: sEnd,
    total_programari: programari.length,
    finalizate: finalizate.length,
    absente: absente.length,
    anulate: anulate.length,
    procent_prezenta: programari.length ? Math.round((finalizate.length / programari.length) * 100) : null,
    venit_total: venit,
    program_activ: null,
    created_at: new Date().toISOString(),
  };

  const istoric = store.tables['istoric_saptamanal'] || (store.tables['istoric_saptamanal'] = []);
  const existing = istoric.find((r) => r.saptamana_start === sStart && r.user_id === DEMO_USER_ID);
  if (existing) Object.assign(existing, week, { id: existing.id, created_at: existing.created_at });
  else istoric.push(week);
  saveStore(store);
  return { data: null, error: null };
}

// ── Autoprogramare ────────────────────────────────────────────

/** Extrage numărul de ședințe/săptămână din câmpul `frecventa` (ex: "2x/săptămână"). */
function weeklyFrequency(p: any): number {
  const m = String(p.frecventa || '').match(/(\d+)/);
  if (m) return Math.max(1, Math.min(7, parseInt(m[1], 10)));
  return 1;
}

/**
 * Completează automat programările pacienților demo pentru următoarele
 * 14 zile, respectând programul de lucru, pauza de masă, durata ședinței
 * + pauza dintre pacienți și frecvența fiecărui pacient.
 * Idempotent — adaugă doar programările lipsă. Returnează true dacă a modificat.
 */
function autoSchedule(store: DemoStore): boolean {
  const settings = (store.tables['settings'] || [])[0] || {};
  const duration = settings.session_duration ?? 50;
  const step = duration + (settings.break_buffer ?? 10);
  const parseT = (t: any, fh: number, fm: number) => {
    const [h, m] = String(t || '').substring(0, 5).split(':').map(Number);
    return (Number.isFinite(h) ? h : fh) * 60 + (Number.isFinite(m) ? m : fm);
  };
  const workStart = parseT(settings.work_start, 8, 0);
  const workEnd = parseT(settings.work_end, 20, 0);
  const lunchStart = parseT(settings.lunch_start, 12, 0);
  const lunchEnd = parseT(settings.lunch_end, 12, 30);
  const workingDays: number[] = Array.isArray(settings.zile_lucratoare) && settings.zile_lucratoare.length
    ? settings.zile_lucratoare
    : [1, 2, 3, 4, 5];

  const programari = store.tables['programari'] || (store.tables['programari'] = []);
  const pacienti = (store.tables['pacienti'] || []).filter((p) => p.status_abonament !== 'terminat');
  if (pacienti.length === 0) return false;

  const fmtTime = (total: number) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}:00`;
  const taken = new Set(programari.filter((a) => a.status !== 'anulat').map((a) => `${a.data}|${a.ora}`));

  // Ultima dată cu programare activă pentru fiecare pacient
  const lastDate = new Map<string, string>();
  for (const p of pacienti) {
    const dates = programari
      .filter((a) => a.pacient_id === p.id && a.status !== 'anulat')
      .map((a) => a.data)
      .sort();
    lastDate.set(p.id, dates.length ? dates[dates.length - 1] : '');
  }
  const daysDiff = (from: string, to: string) =>
    Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000);

  const now = new Date();
  let changed = false;

  for (let offset = 1; offset <= 14; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (!workingDays.includes(d.getDay())) continue;
    const dStr = dateStr(d);

    // Sloturile libere ale zilei
    const free: number[] = [];
    for (let cursor = workStart; cursor + duration <= workEnd; cursor += step) {
      if (cursor < lunchEnd && cursor + duration > lunchStart) continue;
      const ora = fmtTime(cursor);
      if (!taken.has(`${dStr}|${ora}`)) free.push(cursor);
    }

    for (const p of pacienti) {
      if (free.length === 0) break;
      const spacing = Math.max(1, Math.round(7 / weeklyFrequency(p)));
      const ld = lastDate.get(p.id) || '';
      if (ld && daysDiff(ld, dStr) < spacing) continue;

      const cursor = free.shift()!;
      programari.push({
        id: uuid(),
        user_id: DEMO_USER_ID,
        pacient_id: p.id,
        data: dStr,
        ora: fmtTime(cursor),
        locatie: p.locatie || 'Belaqva',
        status: 'programat',
        note: null,
        motiv: null,
        group_id: null,
        created_at: now.toISOString(),
      });
      taken.add(`${dStr}|${fmtTime(cursor)}`);
      lastDate.set(p.id, dStr);
      changed = true;
    }
  }
  return changed;
}

// ── Date inițiale (seed) ──────────────────────────────────────

function seedStore(): DemoStore {
  const now = new Date().toISOString();
  const mkPatient = (prenume: string, nume: string, opt: Partial<any> = {}) => {
    const row: any = {
      id: uuid(),
      user_id: DEMO_USER_ID,
      prenume,
      nume,
      telefon: opt.telefon ?? `07${Math.floor(10000000 + Math.random() * 89999999)}`,
      locatie: opt.locatie ?? 'Belaqva',
      plan: opt.plan ?? 'Abonament 10 ședințe',
      frecventa: opt.frecventa ?? '2x/săptămână',
      cost: opt.cost ?? 150,
      sedinte_total: opt.sedinte_total ?? 10,
      sedinte_folosite: opt.sedinte_folosite ?? 0,
      achitat: opt.achitat ?? true,
      drive_link: opt.drive_link ?? null,
      notite: opt.notite ?? null,
      created_at: (opt.created_at ?? daysAgo(30)).toISOString(),
      updated_at: now,
    };
    return withDerivedPacientiFields(row);
  };

  const pacienti = [
    mkPatient('Ana', 'Ionescu', { sedinte_folosite: 4, locatie: 'Belaqva', cost: 150 }),
    mkPatient('Mihai', 'Popescu', { sedinte_folosite: 9, locatie: 'Ghimbav', cost: 180 }),
    mkPatient('Elena', 'Dumitrescu', { sedinte_folosite: 2, locatie: 'Belaqva', cost: 150 }),
    mkPatient('Andrei', 'Georgescu', { sedinte_folosite: 6, locatie: 'Belaqva', cost: 150, achitat: false, notite: 'A solicitat reprogramare joia.' }),
    mkPatient('Ioana', 'Marin', { sedinte_folosite: 1, locatie: 'Ghimbav', cost: 180, plan: 'Abonament 10 ședințe' }),
    mkPatient('Radu', 'Stan', { sedinte_folosite: 0, locatie: 'Belaqva', cost: 150, plan: 'Ședință unică', sedinte_total: 1 }),
  ];

  const programari: any[] = [];
  const seedTaken = new Set<string>();
  const mkAppt = (patientIdx: number, dayOffset: number, ora: string, status = 'programat', extra: Partial<any> = {}) => {
    const p = pacienti[patientIdx];
    const d = daysAhead(dayOffset);
    // Sari peste weekend pentru programările viitoare
    if (dayOffset > 0 && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + (d.getDay() === 6 ? 2 : 1));
    // Dacă mutarea weekendului a creat suprapunere, deplasează cu câte o oră
    let [h, m] = ora.substring(0, 5).split(':').map(Number);
    let data = dateStr(d);
    let guard = 0;
    while (seedTaken.has(`${data}|${pad(h)}:${pad(m)}:00`) && guard++ < 12) {
      h += 1;
      if (h >= 20) { h = 8; d.setDate(d.getDate() + 1); data = dateStr(d); }
    }
    const oraStr = `${pad(h)}:${pad(m)}:00`;
    seedTaken.add(`${data}|${oraStr}`);
    programari.push({
      id: uuid(),
      user_id: DEMO_USER_ID,
      pacient_id: p.id,
      data,
      ora: oraStr,
      locatie: p.locatie,
      status,
      note: extra.note ?? null,
      motiv: extra.motiv ?? null,
      group_id: extra.group_id ?? null,
      created_at: now,
    });
  };

  // Azi
  mkAppt(0, 0, '08:00:00', 'finalizat');
  mkAppt(1, 0, '09:00:00', 'programat');
  mkAppt(2, 0, '10:00:00', 'programat');
  // Zilele următoare
  mkAppt(0, 1, '08:00:00', 'programat');
  mkAppt(3, 1, '09:00:00', 'programat');
  mkAppt(4, 2, '08:00:00', 'programat');
  mkAppt(1, 2, '09:00:00', 'programat');
  mkAppt(2, 3, '10:00:00', 'programat');
  mkAppt(5, 4, '08:00:00', 'programat');
  // Trecute (pentru rapoarte)
  mkAppt(0, -3, '08:00:00', 'finalizat');
  mkAppt(1, -3, '09:00:00', 'finalizat');
  mkAppt(3, -4, '08:00:00', 'finalizat');
  mkAppt(2, -5, '10:00:00', 'absent');
  mkAppt(0, -6, '08:00:00', 'finalizat');
  mkAppt(4, -7, '08:00:00', 'finalizat');

  const plati = [
    { id: uuid(), user_id: DEMO_USER_ID, pacient_id: pacienti[0].id, suma: 150, data_platii: dateStr(daysAgo(20)), created_at: daysAgo(20).toISOString() },
    { id: uuid(), user_id: DEMO_USER_ID, pacient_id: pacienti[1].id, suma: 180, data_platii: dateStr(daysAgo(15)), created_at: daysAgo(15).toISOString() },
    { id: uuid(), user_id: DEMO_USER_ID, pacient_id: pacienti[3].id, suma: 75, data_platii: dateStr(daysAgo(7)), created_at: daysAgo(7).toISOString() },
  ];

  const pricing_packages = [
    { id: 'demo_p1', user_id: DEMO_USER_ID, name: 'Abonament Standard', plan: 'Abonament', total_sessions: 10, price: 1500, created_at: now },
    { id: 'demo_p2', user_id: DEMO_USER_ID, name: 'Program Individual', plan: 'Abonament', total_sessions: 10, price: 1800, created_at: now },
    { id: 'demo_p3', user_id: DEMO_USER_ID, name: 'Ședință unică', plan: 'Ședință unică', total_sessions: 1, price: 150, created_at: now },
  ];

  const istoric_saptamanal: any[] = [];
  for (let w = 1; w <= 4; w++) {
    const monday = daysAgo(w * 7 + ((new Date().getDay() + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    istoric_saptamanal.push({
      id: uuid(),
      user_id: DEMO_USER_ID,
      saptamana_start: dateStr(monday),
      saptamana_end: dateStr(sunday),
      total_programari: 8,
      finalizate: 6 + (w % 2),
      absente: 1,
      anulate: 0,
      procent_prezenta: Math.round(((6 + (w % 2)) / 8) * 100),
      venit_total: (6 + (w % 2)) * 150,
      program_activ: null,
      created_at: now,
    });
  }

  return {
    seededAt: now,
    tables: {
      settings: [{
        id: uuid(),
        user_id: DEMO_USER_ID,
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
        reminder_threshold: null,
        whatsapp_template: null,
        updated_at: now,
      }],
      profiles: [{ id: DEMO_USER_ID, display_name: 'Cont Demo', username: '@demo', telefon: '', updated_at: now }],
      pacienti,
      programari,
      plati,
      pricing_packages,
      notificari: [{
        id: uuid(),
        user_id: DEMO_USER_ID,
        pacient_id: pacienti[1].id,
        titlu: '🔔 Începe: Mihai',
        mesaj: 'Ședința de la ora 09:00 începe acum.',
        tip: 'reminder',
        citita: false,
        data_declansare: null,
        created_at: now,
      }],
      istoric_saptamanal,
      push_subscriptions: [],
      error_logs: [],
    },
  };
}
