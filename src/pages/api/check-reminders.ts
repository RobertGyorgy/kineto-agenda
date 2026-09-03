import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabaseServer';
import { sendPushToSubscription } from '../../lib/server/webPush';

export const prerender = false;

export const ALL: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseServerClient(cookies, request.headers);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Neautentificat' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculăm data curentă în fusul orar local (România: UTC+2 / UTC+3)
    const now = new Date();
    const roTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit' });
    const roDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' }); // YYYY-MM-DD

    const [curH, curM] = roTimeStr.split(':').map(Number);
    const currentTotalMin = curH * 60 + curM;

    // Citim programările de azi ale utilizatorului curent
    const { data: appts, error: apptError } = await (supabase as any)
      .from('programari')
      .select('id, data, ora, status, pacient_id, pacienti (id, nume, prenume)')
      .eq('user_id', user.id)
      .eq('data', roDateStr)
      .not('status', 'in', '("anulat","absent")');

    if (apptError || !appts || appts.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, sent: 0, time: roTimeStr, date: roDateStr }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Citim dispozitivele utilizatorului curent
    const { data: subscriptions } = await (supabase as any)
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ checked: appts.length, sent: 0, message: 'Niciun dispozitiv abonat.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Citim durata ședinței din setările utilizatorului curent
    const { data: settings } = await (supabase as any)
      .from('settings')
      .select('session_duration')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    const sessionDuration = settings?.session_duration || 50;

    let pushSentCount = 0;

    for (const appt of appts) {
      const cleanTime = (appt.ora || '08:00').substring(0, 5);
      const [h, m] = cleanTime.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + sessionDuration;

      const patientName = appt.pacienti ? (appt.pacienti.prenume === appt.pacienti.nume || !appt.pacienti.nume ? appt.pacienti.prenume : `${appt.pacienti.prenume} ${appt.pacienti.nume}`.trim()) : 'Pacient';

      // 1. Alertă Început Ședință (în intervalul [startMin - 2, startMin + 5])
      if (currentTotalMin >= startMin - 2 && currentTotalMin <= startMin + 5) {
        const notifTag = `start_${appt.id}_${roDateStr}`;

        // Verifică dacă notificarea a fost deja trimisă azi
        const { data: existingNotif } = await (supabase as any)
          .from('notificari')
          .select('id')
          .eq('titlu', `🔔 Începe: ${patientName}`)
          .eq('user_id', user.id)
          .gte('created_at', `${roDateStr}T00:00:00`)
          .maybeSingle();

        if (!existingNotif) {
          // Înregistrează în tabela `notificari`
          await (supabase as any).from('notificari').insert({
            titlu: `🔔 Începe: ${patientName}`,
            mesaj: `Ședința de la ora ${cleanTime} începe acum.`,
            tip: 'reminder',
            citita: false,
            user_id: user.id,
            pacient_id: appt.pacient_id || null
          });

          // Trimite Push la toate dispozitivele utilizatorului
          for (const sub of subscriptions) {
            try {
              await sendPushToSubscription(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                  title: `🔔 Începe ședința: ${patientName}`,
                  body: `La ora ${cleanTime} începe ședința cu ${patientName}.`,
                  url: '/dashboard/calendar',
                  tag: notifTag
                }
              );
              pushSentCount++;
            } catch (err) {}
          }
        }
      }

      // 2. Alertă Final Ședință (în intervalul [endMin - 2, endMin + 5])
      if (currentTotalMin >= endMin - 2 && currentTotalMin <= endMin + 5) {
        const notifTag = `end_${appt.id}_${roDateStr}`;

        const { data: existingNotif } = await (supabase as any)
          .from('notificari')
          .select('id')
          .eq('titlu', `✅ Final: ${patientName}`)
          .eq('user_id', user.id)
          .gte('created_at', `${roDateStr}T00:00:00`)
          .maybeSingle();

        if (!existingNotif) {
          await (supabase as any).from('notificari').insert({
            titlu: `✅ Final: ${patientName}`,
            mesaj: `Ședința cu ${patientName} s-a încheiat. Confirmă prezența.`,
            tip: 'reminder',
            citita: false,
            user_id: user.id,
            pacient_id: appt.pacient_id || null
          });

          for (const sub of subscriptions) {
            try {
              await sendPushToSubscription(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                  title: `✅ Ședință încheiată: ${patientName}`,
                  body: `Ședința de la ora ${cleanTime} s-a încheiat. Apasă pentru a confirma prezența.`,
                  url: '/dashboard/calendar',
                  tag: notifTag
                }
              );
              pushSentCount++;
            } catch (err) {}
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: appts.length, sent: pushSentCount, time: roTimeStr }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('check-reminders error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Eroare server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
