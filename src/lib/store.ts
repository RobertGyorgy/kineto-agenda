/**
 * store.ts — Global Settings & State Store
 * 
 * Singleton lightweight care:
 * - Cachează settings în memorie (fără re-fetch la fiecare componentă)
 * - Emite events globale pentru sincronizare între pagini/componente
 * - Ascultă Supabase Realtime pentru update-uri server-side (opțional)
 * 
 * Usage:
 *   import { getSettingsCache, setSettingsCache, emitSettingsUpdated } from '../lib/store';
 */

import { getSettings } from './services/settingsService';
import type { Settings } from './database.types';

// ── In-memory cache ────────────────────────────────────────────
let _settings: Settings | null = null;
let _settingsPromise: Promise<Settings> | null = null;

/**
 * Returnează settings din cache sau le fetch-uiește din DB (o singură dată).
 * Componente multiple pot apela simultan fără N request-uri paralele.
 */
export async function getSettingsCache(): Promise<Settings> {
  if (_settings) return _settings;
  if (_settingsPromise) return _settingsPromise;

  _settingsPromise = getSettings().then(s => {
    _settings = s;
    _settingsPromise = null;
    return s;
  });

  return _settingsPromise;
}

/**
 * Actualizează cache-ul local și notifică toate componentele.
 * Apelat după saveSettings() din SettingsView.
 */
export function setSettingsCache(settings: Settings) {
  _settings = settings;
  emitSettingsUpdated(settings);
}

/**
 * Invalidează cache-ul (forțează re-fetch la următorul apel).
 */
export function invalidateSettingsCache() {
  _settings = null;
  _settingsPromise = null;
}

// ── Event Emitters ─────────────────────────────────────────────

/**
 * Emite settingsUpdated cu noile settings.
 * Calendar, AddSession etc. ascultă acest event.
 */
export function emitSettingsUpdated(settings?: Settings) {
  window.dispatchEvent(new CustomEvent('settingsUpdated', {
    detail: { settings: settings ?? _settings }
  }));
}

/**
 * Emite sessionsUpdated — re-render agenda, calendar, statistics.
 */
export function emitSessionsUpdated() {
  window.dispatchEvent(new CustomEvent('sessionsUpdated'));
}

/**
 * Emite patientsUpdated — re-render lista pacienți, statistics.
 */
export function emitPatientsUpdated() {
  window.dispatchEvent(new CustomEvent('patientsUpdated'));
}

/**
 * Emite paymentsUpdated — re-render badges plată, statistics.
 */
export function emitPaymentsUpdated(patientId?: string) {
  window.dispatchEvent(new CustomEvent('paymentsUpdated', {
    detail: { patientId }
  }));
}

// ── Helper: format time HH:MM (strip seconds) ─────────────────
export function formatTime(t: string | undefined | null): string {
  if (!t) return '00:00';
  return t.substring(0, 5);
}
