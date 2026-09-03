import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabaseServer';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return new Response(
        JSON.stringify({ error: 'Endpoint și cheile p256dh/auth sunt obligatorii.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseServerClient(cookies, request.headers);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Trebuie să fii autentificat.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await (supabase as any)
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_id: user.id,
          user_agent: userAgent || request.headers.get('user-agent') || 'Browser PWA',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error('Eroare salvare push_subscription:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, subscription: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('push-subscribe POST error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Eroare internă server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint-ul este obligatoriu.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseServerClient(cookies, request.headers);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Trebuie să fii autentificat.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await (supabase as any)
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Eroare internă server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
