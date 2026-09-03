import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabaseServer';
import { sendPushToSubscription, type PushPayload } from '../../lib/server/webPush';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { title, body: msgBody, url, targetUserId } = body;

    const payload: PushPayload = {
      title: title || '🔔 Notificare Agendă Kineto',
      body: msgBody || 'Aceasta este o notificare de test pe ecranul blocat.',
      url: url || '/dashboard',
      tag: 'kineto-test-alert'
    };

    const supabase = createSupabaseServerClient(cookies, request.headers);

    let query = (supabase as any).from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id');
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: subs, error } = await query;
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Niciun dispozitiv înregistrat pentru notificări.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    const expiredSubIds: string[] = [];

    await Promise.all(
      subs.map(async (sub: any) => {
        try {
          await sendPushToSubscription(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload
          );
          sentCount++;
        } catch (pushErr: any) {
          // 410 Gone sau 404 Not Found înseamnă că abonamentul a expirat / a fost anulat
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            expiredSubIds.push(sub.id);
          } else {
            console.warn('Eroare trimitere Web Push la endpoint:', sub.endpoint, pushErr);
          }
        }
      })
    );

    // Curăță automat abonamentele expirate din baza de date
    if (expiredSubIds.length > 0) {
      await (supabase as any).from('push_subscriptions').delete().in('id', expiredSubIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: subs.length,
        cleaned: expiredSubIds.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('send-push API error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Eroare internă' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
