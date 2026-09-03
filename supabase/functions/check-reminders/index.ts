import { createClient } from "@supabase/supabase-js";
import { buildPushHTTPRequest } from "@pushforge/builder";

async function loadVaultSecrets(supabase: any) {
  const { data: secrets, error } = await supabase.rpc("get_vapid_secrets");

  if (error) throw new Error("Vault read error: " + error.message);

  return {
    vapidJwk: JSON.parse(secrets?.VAPID_PRIVATE_JWK || "{}"),
    vapidSubject: secrets?.VAPID_SUBJECT || "",
  };
}

function getRomaniaTimeStrings(now = new Date()) {
  const timeStr = now.toLocaleTimeString("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
  return { timeStr, dateStr };
}

Deno.serve(async (req) => {
  try {
    // Only the Supabase cron job (with the CRON_SECRET) may invoke this function.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret") || "";
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { vapidJwk, vapidSubject } = await loadVaultSecrets(supabase);
    const { timeStr, dateStr } = getRomaniaTimeStrings();
    const [curH, curM] = timeStr.split(":").map(Number);
    const currentTotalMin = curH * 60 + curM;

    const { data: appts, error: apptError } = await supabase
      .from("programari")
      .select("id, data, ora, status, pacient_id, user_id, pacienti (id, nume, prenume)")
      .eq("data", dateStr)
      .not("status", "in", '("anulat","absent")');

    if (apptError) {
      return new Response(JSON.stringify({ error: apptError.message }), { status: 500 });
    }

    if (!appts || appts.length === 0) {
      return new Response(JSON.stringify({ checked: 0, sent: 0, time: timeStr, date: dateStr }), { status: 200 });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id");

    if (subError) {
      return new Response(JSON.stringify({ error: subError.message }), { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ checked: appts.length, sent: 0, message: "Niciun dispozitiv abonat." }),
        { status: 200 }
      );
    }

    const { data: allSettings } = await supabase
      .from("settings")
      .select("user_id, session_duration");
    const settingsByUser = new Map((allSettings || []).map((s: any) => [s.user_id, s.session_duration || 50]));

    const apptsByUser = new Map<string, any[]>();
    for (const appt of appts as any[]) {
      const uid = appt.user_id || "__unknown__";
      if (!apptsByUser.has(uid)) apptsByUser.set(uid, []);
      apptsByUser.get(uid)!.push(appt);
    }

    const subsByUser = new Map<string, any[]>();
    for (const sub of subscriptions as any[]) {
      const uid = sub.user_id || "__unknown__";
      if (!subsByUser.has(uid)) subsByUser.set(uid, []);
      subsByUser.get(uid)!.push(sub);
    }

    let pushSentCount = 0;

    for (const [userId, userAppts] of apptsByUser) {
      const userSubs = subsByUser.get(userId) || [];
      const sessionDuration = settingsByUser.get(userId) || 50;

      for (const appt of userAppts) {
        const cleanTime = (appt.ora || "08:00").substring(0, 5);
        const [h, m] = cleanTime.split(":").map(Number);
        const startMin = h * 60 + m;
        const endMin = startMin + sessionDuration;

        const patientName = appt.pacienti
          ? `${appt.pacienti.prenume || ""} ${appt.pacienti.nume || ""}`.trim()
          : "Pacient";

        // 1. Alertă Început Ședință
        if (currentTotalMin >= startMin - 2 && currentTotalMin <= startMin + 5) {
          const title = `🔔 Începe: ${patientName}`;
          const { data: existing } = await supabase
            .from("notificari")
            .select("id")
            .eq("titlu", title)
            .eq("user_id", userId)
            .gte("created_at", `${dateStr}T00:00:00`)
            .maybeSingle();

          if (!existing) {
            await supabase.from("notificari").insert({
              titlu: title,
              mesaj: `Ședința de la ora ${cleanTime} începe acum.`,
              tip: "reminder",
              citita: false,
              user_id: userId,
              pacient_id: appt.pacient_id || null,
            });

            for (const sub of userSubs) {
              try {
                const { endpoint, headers, body } = await buildPushHTTPRequest({
                  privateJWK: vapidJwk,
                  subscription: {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  message: {
                    payload: {
                      title: `🔔 Începe ședința: ${patientName}`,
                      body: `La ora ${cleanTime} începe ședința cu ${patientName}.`,
                      url: "/dashboard/calendar",
                      tag: `start_${appt.id}_${dateStr}`,
                      icon: "/favicon.svg",
                      badge: "/favicon.svg",
                    },
                    adminContact: vapidSubject,
                    options: { ttl: 60 * 60 * 24 },
                  },
                });

                const res = await fetch(endpoint, { method: "POST", headers, body });
                if (res.ok || res.status === 201) pushSentCount++;
              } catch (_err) {
                // ignore per-subscription errors
              }
            }
          }
        }

        // 2. Alertă Final Ședință
        if (currentTotalMin >= endMin - 2 && currentTotalMin <= endMin + 5) {
          const title = `✅ Final: ${patientName}`;
          const { data: existing } = await supabase
            .from("notificari")
            .select("id")
            .eq("titlu", title)
            .eq("user_id", userId)
            .gte("created_at", `${dateStr}T00:00:00`)
            .maybeSingle();

          if (!existing) {
            await supabase.from("notificari").insert({
              titlu: title,
              mesaj: `Ședința cu ${patientName} s-a încheiat. Confirmă prezența.`,
              tip: "reminder",
              citita: false,
              user_id: userId,
              pacient_id: appt.pacient_id || null,
            });

            for (const sub of userSubs) {
              try {
                const { endpoint, headers, body } = await buildPushHTTPRequest({
                  privateJWK: vapidJwk,
                  subscription: {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  message: {
                    payload: {
                      title: `✅ Ședință încheiată: ${patientName}`,
                      body: `Ședința de la ora ${cleanTime} s-a încheiat. Apasă pentru a confirma prezența.`,
                      url: "/dashboard/calendar",
                      tag: `end_${appt.id}_${dateStr}`,
                      icon: "/favicon.svg",
                      badge: "/favicon.svg",
                    },
                    adminContact: vapidSubject,
                    options: { ttl: 60 * 60 * 24 },
                  },
                });

                const res = await fetch(endpoint, { method: "POST", headers, body });
                if (res.ok || res.status === 201) pushSentCount++;
              } catch (_err) {
                // ignore per-subscription errors
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: appts.length, sent: pushSentCount, time: timeStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-reminders edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Eroare server" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
