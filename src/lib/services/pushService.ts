/**
 * pushService.ts — Client-side Web Push subscription & management
 */

// VAPID Public Key configurată pentru aplicație (PUBLIC_* variabilă de mediu)
export const VAPID_PUBLIC_KEY = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!(await isPushSupported())) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export async function subscribeToPushNotifications(): Promise<{ success: boolean; message?: string }> {
  if (!(await isPushSupported())) {
    return {
      success: false,
      message: 'Dispozitivul sau browserul tău nu suportă notificări Web Push în fundal.'
    };
  }

  try {
    // 1. Solicită permisiunea utilizatorului
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Permisiunea pentru notificări a fost refuzată. Te rugăm să o activezi din setările browserului.'
      };
    }

    // 2. Așteaptă Service Worker-ul activ
    const reg = await navigator.serviceWorker.ready;

    // 3. Verifică dacă există deja un abonament vechi sau creează unul nou
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any
      });
    }

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      throw new Error('Nu s-au putut obține cheile de securitate ale dispozitivului.');
    }

    // 4. Salvează abonamentul pe server în Supabase
    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        },
        userAgent: navigator.userAgent
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Eroare la salvarea abonamentului pe server.');
    }

    // 5. Trimite o notificare instant de confirmare pe ecranul blocat
    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🔔 Notificări de fundal activate!',
        body: 'Vei primi alerte pe ecranul blocat la începutul și sfârșitul fiecărei ședințe.',
        url: '/dashboard'
      })
    }).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('subscribeToPushNotifications error:', err);
    return {
      success: false,
      message: err.message || 'A apărut o eroare la activarea notificărilor.'
    };
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean }> {
  try {
    if (!(await isPushSupported())) return { success: true };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push-subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      }).catch(() => {});
      await sub.unsubscribe();
    }
    return { success: true };
  } catch (err) {
    console.error('unsubscribeFromPush error:', err);
    return { success: false };
  }
}
