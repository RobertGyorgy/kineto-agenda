/**
 * One-time sync: migrate payments stored only in localStorage into Supabase `plati`.
 *
 * How to run:
 * 1. Open the app in a browser where you previously recorded payments.
 * 2. Open DevTools → Console.
 * 3. Paste this entire script and press Enter.
 * 4. Wait for the success/error messages.
 * 5. Refresh the app.
 */
(async function syncLocalStoragePayments() {
  const SUPABASE_URL = window.__SUPABASE_URL__ || localStorage.getItem('supabase.url') || 'PASTE_YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || localStorage.getItem('supabase.anon_key') || 'PASTE_YOUR_SUPABASE_ANON_KEY';

  if (!SUPABASE_URL || SUPABASE_URL.includes('PASTE')) {
    console.error('Add your Supabase URL and anon key at the top of this script, or expose them as window.__SUPABASE_URL__ / window.__SUPABASE_ANON_KEY__');
    return;
  }

  const keys = Object.keys(localStorage).filter(k => k.startsWith('kineto_plati_'));
  if (keys.length === 0) {
    console.log('No localStorage payments found.');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
  };

  for (const key of keys) {
    const patientId = key.replace('kineto_plati_', '');
    let items;
    try {
      items = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      console.error(`Skipping ${key}: invalid JSON`, e);
      continue;
    }

    if (!Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      const suma = Number(item.suma || 0);
      if (!suma || suma <= 0) continue;

      const date = item.timestamp
        ? new Date(item.timestamp).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/plati`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pacient_id: patientId,
            suma: suma,
            data_platii: date,
            metoda: 'sync localStorage'
          })
        });

        if (!res.ok) {
          const err = await res.text();
          console.error(`Failed to sync payment for ${patientId}:`, err);
        } else {
          console.log(`Synced ${suma} RON for patient ${patientId}`);
        }
      } catch (e) {
        console.error(`Network error syncing ${patientId}:`, e);
      }
    }
  }

  console.log('Sync complete. Refresh the app to see updated stats.');
})();
