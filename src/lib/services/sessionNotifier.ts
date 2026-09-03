/**
 * sessionNotifier.ts — Notificări Web Automate pentru începutul și sfârșitul ședințelor
 */
import { getAppointmentsByDate, getPendingWrapUps } from './appointmentService';
import { getSettings } from './settingsService';
import { toLocalISOString } from '../../utils/date';

let isNotifierRunning = false;
let checkIntervalId: any = null;

const WRAPUP_PROMPT_KEY = 'kineto-wrapup-prompted';
const NOTIFIER_KEY = 'kineto-session-notifier';

// Persistăm cheile de notificare în localStorage ca să nu se re-trimită
// la fiecare revenire în app sau la fiecare reload de pagină.
function getNotifiedKeys(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(NOTIFIER_KEY) || '{}');
  } catch {
    return {};
  }
}

function setNotifiedKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const keys = getNotifiedKeys();
    keys[key] = true;
    localStorage.setItem(NOTIFIER_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function clearOldNotifiedKeys(todayStr: string) {
  if (typeof window === 'undefined') return;
  try {
    const keys = getNotifiedKeys();
    const updated: Record<string, boolean> = {};
    Object.entries(keys).forEach(([k, v]) => {
      if (k.startsWith(`${todayStr}_`)) updated[k] = v;
    });
    localStorage.setItem(NOTIFIER_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') {
      import('./pushService').then(({ subscribeToPushNotifications }) => {
        subscribeToPushNotifications().catch(() => {});
      }).catch(() => {});
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      import('./pushService').then(({ subscribeToPushNotifications }) => {
        subscribeToPushNotifications().catch(() => {});
      }).catch(() => {});
      await triggerWebNotification(
        '🔔 Notificări Active!',
        'Vei primi notificări la începutul și finalul fiecărei ședințe.'
      );
      return true;
    }
    return false;
  } catch (e) {
    console.warn('requestPermission error:', e);
    return false;
  }
}

export function initSessionNotifier() {
  if (typeof window === 'undefined') return;
  if (isNotifierRunning) return;

  isNotifierRunning = true;

  // Expunere pe window pentru testare și utilizare
  (window as any).requestNotificationPermission = requestNotificationPermission;
  (window as any).testNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      await triggerWebNotification('🔔 Test Notificare', 'Notificările funcționează perfect pe acest dispozitiv!');
    } else {
      alert('Permisiunea pentru notificări este oprită în browser. Te rog să o activezi din setările browserului.');
    }
  };

  // Pe browsere moderne (iOS / Android / Desktop), cererea de permisiune necesită un gest utilizator (click / tap).
  // Înregistrăm un handler one-time pe prima interacțiune dacă permisiunea este 'default'.
  if ('Notification' in window && Notification.permission === 'default') {
    const askPermissionOnFirstTouch = async () => {
      document.removeEventListener('click', askPermissionOnFirstTouch);
      document.removeEventListener('touchend', askPermissionOnFirstTouch);
      document.removeEventListener('touchstart', askPermissionOnFirstTouch);
      await requestNotificationPermission();
    };
    document.addEventListener('click', askPermissionOnFirstTouch, { once: true });
    document.addEventListener('touchend', askPermissionOnFirstTouch, { once: true });
    document.addEventListener('touchstart', askPermissionOnFirstTouch, { once: true });
  }

  // La pornirea/revenirea în app: deschide popup-ul de confirmare pentru ședințele de azi
  // trecute neconfirmate. Nu mai re-promptăm sesiuni istorice la fiecare deschidere.
  promptMissedSessionWrapUp();

  // Verifică imediat și apoi la fiecare 20 de secunde (notificări realtime)
  checkTodaySessionsForNotifications();
  checkIntervalId = setInterval(checkTodaySessionsForNotifications, 20 * 1000);

  // Pe mobil: Când utilizatorul deblochează telefonul sau comută înapoi în aplicație, verificăm instant!
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      promptMissedSessionWrapUp();
      checkTodaySessionsForNotifications();
    }
  });
  window.addEventListener('focus', () => {
    promptMissedSessionWrapUp();
    checkTodaySessionsForNotifications();
  });
}

// Coada de ședințe de azi trecute neconfirmate care trebuie afișate pe rând.
let wrapUpQueue: string[] = [];
let wrapUpQueueActive = false;

function getQueuedWrapUpIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WRAPUP_PROMPT_KEY + '_queue');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setQueuedWrapUpIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WRAPUP_PROMPT_KEY + '_queue', JSON.stringify(ids));
  } catch {
    // ignore localStorage errors
  }
}

// Deschide popup-ul de wrap-up pentru fiecare ședință de azi trecută neconfirmată,
// una câte una. Când una se închide, următoarea din coadă este afișată.
async function promptMissedSessionWrapUp() {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  try {
    const pending = await getPendingWrapUps();
    if (!pending || pending.length === 0) {
      wrapUpQueue = [];
      setQueuedWrapUpIds([]);
      return;
    }

    const todayStr = toLocalISOString(new Date());
    // Auto-prompt doar pentru ședințele de azi. Sesiunile mai vechi rămân vizibile în calendar,
    // dar nu mai blochează experiența la fiecare deschidere a aplicației.
    const todayPending = pending.filter((a: any) => a.data === todayStr);
    const ids = todayPending.map((a: any) => a.id).filter(Boolean);

    // Păstrează doar ID-urile care mai sunt în pending (elimină cele rezolvate).
    const savedQueue = getQueuedWrapUpIds();
    const currentQueue = savedQueue.filter((id) => ids.includes(id));

    // Adaugă în coadă ședințele noi care nu au fost deja promptuite azi.
    let promptedMap: Record<string, string> = {};
    try {
      promptedMap = JSON.parse(localStorage.getItem(WRAPUP_PROMPT_KEY) || '{}');
    } catch {
      // ignore
    }

    for (const id of ids) {
      if (!currentQueue.includes(id) && promptedMap[id] !== todayStr) {
        currentQueue.push(id);
      }
    }

    wrapUpQueue = currentQueue;
    setQueuedWrapUpIds(wrapUpQueue);

    if (wrapUpQueue.length === 0 || wrapUpQueueActive) return;

    const nextId = wrapUpQueue[0];
    if (!nextId) return;

    // Marchează ID-ul ca fiind deja auto-promptuit azi.
    promptedMap[nextId] = todayStr;
    try {
      localStorage.setItem(WRAPUP_PROMPT_KEY, JSON.stringify(promptedMap));
    } catch {
      // ignore localStorage errors
    }

    const confirmSession = (window as any).confirmSession;
    if (typeof confirmSession !== 'function') return;

    wrapUpQueueActive = true;
    confirmSession(nextId);
  } catch (err) {
    console.error('promptMissedSessionWrapUp error:', err);
  }
}

// Când utilizatorul închide un popup de wrap-up, afișează următorul din coadă.
if (typeof window !== 'undefined') {
  window.addEventListener('sessionWrapupClosed', () => {
    wrapUpQueue.shift();
    setQueuedWrapUpIds(wrapUpQueue);
    wrapUpQueueActive = false;
    setTimeout(() => {
      promptMissedSessionWrapUp();
    }, 300);
  });
}

async function checkTodaySessionsForNotifications() {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const todayStr = toLocalISOString(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const canUseWebNotifications = 'Notification' in window && Notification.permission === 'granted';

  try {
    const [appts, settings] = await Promise.all([
      getAppointmentsByDate(todayStr),
      getSettings()
    ]);

    if (!appts || appts.length === 0) return;

    // Curăță notificările din zilele trecute pentru a nu umple localStorage.
    clearOldNotifiedKeys(todayStr);

    const sessionDuration = settings?.session_duration || 50;
    const notifiedKeys = getNotifiedKeys();

    // Grupăm programările active după group_id sau interval orar comun
    interface NotificationItem {
      isGroup: boolean;
      groupId?: string;
      ora: string;
      appointments: any[];
      patientNames: string[];
      location: string;
    }

    const groupsMap = new Map<string, any[]>();
    const singles: any[] = [];

    for (const a of appts) {
      if (a.status === 'anulat' || a.status === 'absent') continue;
      if (a.group_id) {
        if (!groupsMap.has(a.group_id)) groupsMap.set(a.group_id, []);
        groupsMap.get(a.group_id)!.push(a);
      } else {
        singles.push(a);
      }
    }

    // Identificăm sesiunile individuale programate la aceeași oră pentru auto-grupare
    const byTime = new Map<string, any[]>();
    const trueSingles: any[] = [];
    for (const s of singles) {
      const timeKey = (s.ora || '08:00').substring(0, 5);
      if (!byTime.has(timeKey)) byTime.set(timeKey, []);
      byTime.get(timeKey)!.push(s);
    }

    for (const [tKey, sameTimeList] of byTime) {
      if (sameTimeList.length > 1) {
        const autoKey = `time_group_${todayStr}_${tKey}`;
        groupsMap.set(autoKey, sameTimeList);
      } else {
        trueSingles.push(sameTimeList[0]);
      }
    }

    const notifItems: NotificationItem[] = [];
    for (const s of trueSingles) {
      const pName = s.pacienti ? (s.pacienti.prenume === s.pacienti.nume || !s.pacienti.nume ? s.pacienti.prenume : `${s.pacienti.prenume} ${s.pacienti.nume}`.trim()) : 'Pacient';
      notifItems.push({
        isGroup: false,
        ora: s.ora || '08:00',
        appointments: [s],
        patientNames: [pName],
        location: s.pacienti?.locatie || 'Belaqva',
      });
    }

    for (const [gId, members] of groupsMap) {
      const names = members.map((m: any) => m.pacienti ? (m.pacienti.prenume === m.pacienti.nume || !m.pacienti.nume ? m.pacienti.prenume : `${m.pacienti.prenume} ${m.pacienti.nume}`.trim()) : 'Pacient');
      notifItems.push({
        isGroup: true,
        groupId: gId,
        ora: members[0].ora || '08:00',
        appointments: members,
        patientNames: names,
        location: members[0].pacienti?.locatie || 'Belaqva',
      });
    }

    // Sortare cronologică
    notifItems.sort((a, b) => a.ora.localeCompare(b.ora));

    for (let i = 0; i < notifItems.length; i++) {
      const item = notifItems[i];
      const timeStr = (item.ora || '08:00').substring(0, 5);
      const parts = timeStr.split(':');
      const startH = parseInt(parts[0] || '8', 10);
      const startM = parseInt(parts[1] || '0', 10);
      const startTotalMin = startH * 60 + startM;
      const endTotalMin = startTotalMin + sessionDuration;

      const groupKey = item.isGroup ? `group_${item.groupId || item.ora}` : `single_${item.appointments[0].id}`;
      const endKey = `${todayStr}_${groupKey}_end`;

      // Notificare SFÂRȘIT ȘEDINȚĂ
      // Fereastră de la final până la 5 min după.
      if (currentMinutes >= endTotalMin && currentMinutes <= endTotalMin + 5) {
        if (!notifiedKeys[endKey]) {
          setNotifiedKey(endKey);

          // Marchează și cheile per-appointment pentru a preveni declanșări duplicate
          for (const appt of item.appointments) {
            setNotifiedKey(`${todayStr}_${appt.id}_end`);
          }

          // Pauza de masă (pentru sumarul notificării)
          const lunchStartStr = (settings?.lunch_start || '12:00').substring(0, 5);
          const lunchEndStr = (settings?.lunch_end || '12:30').substring(0, 5);
          const [lsh, lsm] = lunchStartStr.split(':').map(Number);
          const [leh, lem] = lunchEndStr.split(':').map(Number);
          const lunchStartMin = (lsh || 0) * 60 + (lsm || 0);
          const lunchEndMin = (leh || 0) * 60 + (lem || 0);

          // Caută dacă urmează un alt pacient sau grup
          const nextItem = notifItems.slice(i + 1).find(n => n.appointments.some((a: any) => a.status !== 'anulat' && a.status !== 'absent'));
          let summaryMessage = '';

          const lunchFitsBeforeNext =
            lunchStartMin >= endTotalMin &&
            (!nextItem || lunchEndMin <= ((nextItem.ora || '00:00').substring(0, 5).split(':').map(Number)[0] * 60 + (nextItem.ora || '00:00').substring(0, 5).split(':').map(Number)[1]));

          if (lunchFitsBeforeNext) {
            summaryMessage += ` Pauză de masă ${lunchStartStr}-${lunchEndStr}.`;
          }

          if (nextItem) {
            const nextNames = nextItem.isGroup 
              ? `Grup (${nextItem.patientNames.join(', ')})` 
              : nextItem.patientNames[0];
            const nextTime = (nextItem.ora || '').substring(0, 5);
            summaryMessage += ` Urmează ${nextNames} la ora ${nextTime}.`;
          } else {
            summaryMessage += ` Ultima ședință a zilei.`;
          }

          // Popup în app — deschide wrapup pentru prima sesiune din grup/individuală
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openWrapUp', {
                detail: { appointment: item.appointments[0] }
              }));
            }, 500);
          }

          if (canUseWebNotifications) {
            if (item.isGroup) {
              const namesStr = item.patientNames.join(', ');
              await triggerWebNotification(
                `👥 S-a încheiat ședința de grup`,
                `Ședința de grup de la ora ${timeStr} (${namesStr}) s-a încheiat.${summaryMessage} Apasă pentru confirmare.`,
                endKey
              );
            } else {
              const patientName = item.patientNames[0];
              await triggerWebNotification(
                `✅ S-a încheiat: ${patientName}`,
                `Ședința de la ora ${timeStr} s-a încheiat.${summaryMessage} Apasă pentru confirmare.`,
                endKey
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('SessionNotifier check error:', err);
  }
}

export async function triggerWebNotification(title: string, body: string, tag = 'kineto-session-alert') {
  try {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options: any = {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      renotify: true,
      data: { url: '/dashboard' },
      vibrate: [200, 100, 200]
    };

    // 1. Suport Mobil principal: Trimitere prin Service Worker (Necesitate absolută pentru iOS Safari 16.4+ și Android Chrome)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      } catch (swErr) {
        console.warn('SW showNotification fallback:', swErr);
      }
    }

    // 2. Fallback Desktop pentru browserele standard
    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (e) {
    console.error('Error triggering web notification:', e);
  }
}
