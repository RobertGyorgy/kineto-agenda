/**
 * intercept.ts — Proxy peste clientul Supabase browser.
 *
 * Dacă sesiunea curentă aparține contului demo, `supabase.from(...)` și
 * `supabase.rpc(...)` sunt servite din baza de date locală (localStorage).
 * În caz contrar, apelurile sunt redate (replay) pe clientul real PostgREST.
 */
import { isDemoUserId } from './config';
import { runDemoQuery, runDemoRpc } from './localDb';

type Op = { name: string; args: any[] };

export class DemoAwareBuilder {
  private ops: Op[] = [];

  constructor(
    private table: string,
    private realClient: any,
  ) {}

  private record(name: string, ...args: any[]) {
    this.ops.push({ name, args });
    return this;
  }

  // ── API fluent (aceeași suprafață ca PostgrestFilterBuilder) ──
  select(...args: any[]) { return this.record('select', ...args); }
  insert(...args: any[]) { return this.record('insert', ...args); }
  update(...args: any[]) { return this.record('update', ...args); }
  upsert(...args: any[]) { return this.record('upsert', ...args);  }
  delete(...args: any[]) { return this.record('delete', ...args); }
  eq(...args: any[]) { return this.record('eq', ...args); }
  neq(...args: any[]) { return this.record('neq', ...args); }
  gt(...args: any[]) { return this.record('gt', ...args); }
  gte(...args: any[]) { return this.record('gte', ...args); }
  lt(...args: any[]) { return this.record('lt', ...args); }
  lte(...args: any[]) { return this.record('lte', ...args); }
  in(...args: any[]) { return this.record('in', ...args); }
  not(...args: any[]) { return this.record('not', ...args); }
  is(...args: any[]) { return this.record('is', ...args); }
  or(...args: any[]) { return this.record('or', ...args); }
  ilike(...args: any[]) { return this.record('ilike', ...args); }
  like(...args: any[]) { return this.record('like', ...args); }
  order(...args: any[]) { return this.record('order', ...args); }
  limit(...args: any[]) { return this.record('limit', ...args); }

  single() { return this.execute('single'); }
  maybeSingle() { return this.execute('maybeSingle'); }

  /** Permite `await builder` fără terminal explicit. */
  then(onFulfilled: any, onRejected: any) {
    return this.execute('all').then(onFulfilled, onRejected);
  }

  private async isDemoSession(): Promise<boolean> {
    try {
      const { data: { session } } = await this.realClient.auth.getSession();
      return isDemoUserId(session?.user?.id);
    } catch {
      return false;
    }
  }

  private async execute(mode: 'all' | 'single' | 'maybeSingle') {
    if (await this.isDemoSession()) {
      return runDemoQuery(this.table, this.ops, mode);
    }
    // Reconstituie lanțul pe clientul real PostgREST
    let b: any = this.realClient.from(this.table);
    for (const op of this.ops) {
      b = b[op.name](...op.args);
    }
    if (mode === 'single') return b.single();
    if (mode === 'maybeSingle') return b.maybeSingle();
    return b;
  }
}

/**
 * Înfășoară clientul Supabase: `from`/`rpc` devin demo-aware,
 * restul proprietăților (auth, storage, functions) trec nemodificate.
 */
export function wrapSupabaseClient<T extends object>(realClient: T): T {
  const check = async () => {
    try {
      const { data: { session } } = await (realClient as any).auth.getSession();
      return isDemoUserId(session?.user?.id);
    } catch {
      return false;
    }
  };

  return new Proxy(realClient as any, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => new DemoAwareBuilder(table, target);
      }
      if (prop === 'rpc') {
        return async (fn: string, args?: any) => {
          if (await check()) return runDemoRpc(fn, args);
          return (target as any).rpc(fn, args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}
