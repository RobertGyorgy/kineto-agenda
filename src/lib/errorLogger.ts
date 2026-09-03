/**
 * errorLogger.ts — Captură globală erori și jurnal local + sync Supabase
 *
 * - Stochează erorile în localStorage pentru afișare imediată (funcționează și offline).
 - Încearcă să le trimită automat în tabela `error_logs` din Supabase.
 * - Dacă utilizatorul nu e logat sau DB-ul pică, le ține într-o coadă de sync
 *   și le trimite când auth-ul revine.
 */

export type LogType = 'error' | 'warning' | 'fetch' | 'rejection' | 'manual';

export interface LogEntry {
  id: string;
  type: LogType;
  timestamp: number; // ms epoch
  source: string;    // modulul/componenta care a raportat
  message: string;   // mesaj scurt, lizibil
  details?: string;  // payload serializat, JSON, status HTTP etc.
  stack?: string;    // stack trace dacă e disponibil
  interpretation: string; // explicație umană + ce să facă utilizatorul
}

interface PendingErrorLog {
  type: LogType;
  source: string;
  message: string;
  details?: string;
  stack?: string;
  interpretation: string;
  created_at: string;
}

const STORAGE_KEY = 'kineto_error_logs_v1';
const PENDING_SYNC_KEY = 'kineto_error_logs_pending_v1';
const MAX_LOGS = 200;
const MAX_PENDING = 500;

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Încearcă să extragă un mesaj lizibil din orice valoare primită.
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    if ('message' in err && typeof (err as any).message === 'string') return (err as any).message;
    if ('error_description' in err && typeof (err as any).error_description === 'string') return (err as any).error_description;
    try {
      return JSON.stringify(err);
    } catch {
      return '[obiect nerecunoscut]';
    }
  }
  return String(err);
}

/**
 * Încearcă să extragă stack trace-ul, dacă există.
 */
function extractStack(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) return err.stack;
  return undefined;
}

/**
 * Detectează coduri Supabase / PostgreSQL și alte patternuri frecvente
 * pentru a genera o interpretare în limba română.
 */
export function interpretError(err: unknown, context?: string): string {
  const msg = extractMessage(err).toLowerCase();
  const ctx = (context || '').toLowerCase();
  const full = msg + ' ' + ctx;

  // --- Autentificare / autorizare ---
  if (msg.includes('jwt issued at future') || msg.includes('iat')) {
    return 'Tokenul JWT a fost emis cu o dată din viitor. De obicei înseamnă că ceasul dispozitivului tău este înaintea serverului Supabase. Verifică și setează ora dispozitivului pe „automată”, apoi reîncarcă aplicația.';
  }
  if (msg.includes('jwt expired') || msg.includes('token has expired')) {
    return 'Sesiunea a expirat. Deloghează-te și loghează-te din nou pentru un token nou.';
  }
  if (full.includes('401') || msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('auth')) {
    return 'Sesiunea de autentificare a expirat sau tokenul este invalid. Încearcă să te deloghezi și să te reconectezi. Dacă persistă, verifică dacă contul are dreptul să acceseze această resursă.';
  }
  if (full.includes('406') || msg.includes('not acceptable')) {
    return 'Request-ul către Supabase nu a fost acceptat (406 Not Acceptable). De obicei apare când tokenul este invalid/expirat sau când header-ele cererii sunt greșite. Reautentifică-te.';
  }
  if (msg.includes('permission denied') || msg.includes('policy') || msg.includes('rls')) {
    return 'Nu ai permisiunea să execuți această operațiune. Verifică regulile RLS (Row Level Security) din Supabase sau asigură-te că ești autentificat cu contul corect.';
  }

  // --- Constrângeri bază de date ---
  if (msg.includes('23514') || msg.includes('check constraint') || msg.includes('violates check constraint')) {
    return 'Datele trimise în baza de date încalcă o regulă de validare (check constraint). Cel mai frecvent: sedinte_folosite > sedinte_total sau un câmp numeric este în afara intervalului permis. Verifică contoarele pacientului și retrimite.';
  }
  if (msg.includes('23505') || msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return 'Există deja o înregistrare cu aceleași valori unice (de exemplu un pacient cu același nume sau o programare dublă). Alege o altă valoare sau editează înregistrarea existentă.';
  }
  if (msg.includes('23503') || msg.includes('foreign key constraint')) {
    return 'O înregistrare face referință la altă înregistrare care nu mai există (de exemplu o programare pentru un pacient șters). Șterge referința invalidă sau recreează înregistrarea părinte.';
  }
  if (msg.includes('not-null') || msg.includes('not null')) {
    return 'Un câmp obligatoriu nu a fost completat. Completează toate câmpurile marcate și reîncearcă.';
  }

  // --- Business logic / aplicație ---
  if (msg.includes('nu există rând de settings')) {
    return 'Tabela settings este goală. Asigură-te că există cel puțin un rând inițial în Supabase pentru ca aplicația să poată funcționa.';
  }
  if (ctx.includes('finalizarea sesiunii') || ctx.includes('completesession')) {
    if (msg.includes('check constraint')) {
      return 'Finalizarea sesiunii a eșuat pentru că numărul de ședințe folosite ar depăși totalul. Reînoiește abonamentul pacientului sau corectează contorul din baza de date.';
    }
    return 'Finalizarea sesiunii a eșuat. Verifică conexiunea și starea programării, apoi reîncearcă.';
  }
  if (ctx.includes('programare') || ctx.includes('appointment')) {
    return 'A apărut o problemă la salvarea/ citirea programării. Verifică datele introduse (dată/oră/nume) și conexiunea la internet.';
  }
  if (ctx.includes('pacient')) {
    return 'A apărut o problemă la salvarea/ citirea pacientului. Verifică dacă numele este unic și că toate câmpurile obligatorii sunt completate.';
  }
  if (ctx.includes('plată') || ctx.includes('payment')) {
    return 'A apărut o problemă la înregistrarea plății. Verifică suma introdusă și conexiunea, apoi reîncearcă.';
  }

  // --- Rețea / generice ---
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Conexiunea la server a eșuat. Verifică internetul și încearcă din nou.';
  }
  if (msg.includes('timeout')) {
    return 'Cererea a durat prea mult. Serverul este posibil suprasolicitat. Încearcă din nou peste câteva secunde.';
  }

  return 'A apărut o eroare neașteptată. Dacă se repetă, notează mesajul și contactează suportul tehnic.';
}

/**
 * Citește logurile locale.
 */
function readLocalLogs(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Scrie logurile locale.
 */
function writeLocalLogs(logs: LogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

/**
* Citește coada de loguri care nu au putut fi trimise în Supabase.
 */
function readPending(): PendingErrorLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Scrie coada de loguri în așteptare.
 */
function writePending(pending: PendingErrorLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
  } catch {
    // ignore
  }
}

/**
 * Încearcă să insereze un log în Supabase.
 * Returnează true dacă a reușit, false altfel.
 */
async function sendLogToSupabase(entry: LogEntry | PendingErrorLog): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { supabase } = await import('./supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const createdAt = 'timestamp' in entry
      ? new Date(entry.timestamp).toISOString()
      : entry.created_at;

    const { error } = await (supabase as any).from('error_logs').insert({
      user_id: user.id,
      type: entry.type,
      source: entry.source,
      message: entry.message,
      details: entry.details ?? null,
      stack: entry.stack ?? null,
      interpretation: entry.interpretation,
      user_agent: navigator.userAgent,
      created_at: createdAt,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Adaugă o intrare în jurnal local și încearcă să o trimită în Supabase.
 */
export function pushLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const newEntry: LogEntry = { ...entry, id: generateId(), timestamp: Date.now() };

  if (typeof window !== 'undefined') {
    try {
      const logs = readLocalLogs();
      logs.unshift(newEntry);
      while (logs.length > MAX_LOGS) logs.pop();
      writeLocalLogs(logs);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[errorLogger] Nu s-a putut salva logul local:', e);
    }

    // Trimitem asincron în Supabase; dacă eșuează, intră în coadă.
    sendLogToSupabase(newEntry).then((ok) => {
      if (!ok) {
        const pending = readPending();
        pending.unshift({
          type: newEntry.type,
          source: newEntry.source,
          message: newEntry.message,
          details: newEntry.details,
          stack: newEntry.stack,
          interpretation: newEntry.interpretation,
          created_at: new Date(newEntry.timestamp).toISOString(),
        });
        while (pending.length > MAX_PENDING) pending.pop();
        writePending(pending);
      }
    });
  }

  return newEntry;
}

/**
 * Trimite logurile din coada locală în Supabase.
 * Apelată automat la login și la init.
 */
export async function syncPendingLogs(): Promise<void> {
  if (typeof window === 'undefined') return;
  let pending = readPending();
  if (pending.length === 0) return;

  const failed: PendingErrorLog[] = [];
  for (const entry of pending) {
    const ok = await sendLogToSupabase(entry);
    if (!ok) failed.push(entry);
  }

  writePending(failed);
}

/**
 * Captură convenabilă pentru excepții JavaScript.
 */
export function captureException(err: unknown, context?: string): LogEntry {
  const message = extractMessage(err);
  return pushLog({
    type: 'error',
    source: context || 'app',
    message,
    details: typeof err === 'object' && err !== null ? JSON.stringify(err) : undefined,
    stack: extractStack(err),
    interpretation: interpretError(err, context),
  });
}

/**
 * Captură pentru erori de rețea / Supabase fetch.
 */
export function captureFetchError(url: string, status: number, responseText?: string): LogEntry {
  const message = `Cerere eșuată: ${status} la ${url}`;
  return pushLog({
    type: 'fetch',
    source: 'supabase',
    message,
    details: JSON.stringify({ status, url, response: responseText }),
    interpretation: interpretError({ message: String(status) }, `fetch ${url}`),
  });
}

/**
 * Citește toate logurile stocate local (pentru afișare în UI).
 */
export function getLogs(): LogEntry[] {
  return readLocalLogs();
}

/**
 * Șterge logurile locale și cele din Supabase pentru utilizatorul curent.
 */
export async function clearLogs(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(PENDING_SYNC_KEY);

    const { supabase } = await import('./supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Șterge toate logurile din tabel, inclusiv pe cele fără user_id
      await supabase.from('error_logs').delete().neq('id', '');
    }
  } catch {
    // ignore
  }
}

/**
 * Formatează timestamp-ul pentru afișare: DD.MM.YYYY HH:mm:ss.
 */
export function formatLogTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Instalează handler-ele globale de captură a erorilor.
 * Apelată o singură dată în layout-ul principal.
 */
export function initErrorLogger(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__kinetoErrorLoggerInstalled) return;
  (window as any).__kinetoErrorLoggerInstalled = true;

  window.addEventListener('error', (event) => {
    captureException(event.error || event.message, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, 'window.onunhandledrejection');
  });

  // Suprascriem console.error doar pentru a captura, nu blocăm output-ul original.
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    try {
      const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (message.includes('[errorLogger]')) return;
      pushLog({
        type: 'error',
        source: 'console.error',
        message: message.slice(0, 500),
        interpretation: interpretError(message, 'console.error'),
      });
    } catch {
      // ignore
    }
  };

  // Încercăm să sincronizăm logurile din coadă și ascultăm schimbări de auth.
  syncPendingLogs().catch(() => {/* ignore */});

  import('./supabase').then(({ supabase }) => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        syncPendingLogs().catch(() => {/* ignore */});
      }
    });
  }).catch(() => {
    // ignore — va încerca din nou la următorul log
  });
}
