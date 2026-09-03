/**
 * Format a Date as YYYY-MM-DD in the user's local timezone.
 * Avoids the UTC-shift bug from calling toISOString() on local-midnight dates.
 */
export function toLocalISOString(date: Date): string {
  if (!date) return new Date().toISOString().split('T')[0];
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
}

// Polyfill Date.prototype.toLocalISOString for total safety
if (typeof Date !== 'undefined' && !(Date.prototype as any).toLocalISOString) {
  (Date.prototype as any).toLocalISOString = function (this: Date) {
    return toLocalISOString(this);
  };
}

/**
 * Parse a YYYY-MM-DD string into a local Date (midnight local time).
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/**
 * Format a local date as Romanian short date, e.g. "12 aug".
 */
export function formatDateRO(date: Date, showYear = false): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('ro-RO', { month: 'short' });
  if (showYear) {
    return `${day} ${month} ${date.getFullYear()}`;
  }
  return `${day} ${month}`;
}
