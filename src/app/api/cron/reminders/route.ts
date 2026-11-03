import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { askClaude } from "@/lib/ai-server";
import { buildContext, toIdea, type AiIdea } from "@/lib/context";
import { computeDue, emailHtml, inQuietHours, limaHour, limaToday, pending } from "@/lib/reminders";
import { toV3 } from "@/lib/migrate";
import type { DeliveryLog, State } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Servicio programado (Vercel Cron): funciona con el dashboard cerrado.
 * 1) Lee el estado compartido (Supabase) 2) calcula avisos del día (America/Lima)
 * 3) si una fecha próxima no tiene ideas, la IA las prepara de verdad y las guarda
 * 4) envía correo (Resend) y push (Web Push) sin duplicar (clave única) y reintenta fallos hasta 3 veces.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await sb.from("workspace_state").select("data").eq("id", "main").maybeSingle();
  if (error || !row) return NextResponse.json({ ok: false, error: error?.message ?? "Sin datos" }, { status: 500 });
  const s = toV3(row.data);

  const now = new Date(), today = limaToday(now), hour = limaHour(now);
  if (inQuietHours(s.prefs.quiet, hour)) return NextResponse.json({ ok: true, skipped: "horario de silencio", hour });

  const todo = pending(computeDue(s, today), s.deliveryLog ?? []);
  const creator = s.users.find((u) => u.role === "creator" && u.active);
  const emails = [...new Set([...(s.prefs.recipients ?? []), ...s.users.filter((u) => u.active && u.email).map((u) => u.email)])].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  // Ideas preparadas por la IA para fechas que se acercan y aún no tienen ideas.
  const aiKey = process.env.ANTHROPIC_API_KEY;
  let generated = 0;
  const newIdeas = [] as ReturnType<typeof toIdea>[];
  if (aiKey) {
    for (const n of todo) {
      if (!n.eventId || s.ideas.some((i) => i.eventId === n.eventId && i.status !== "descartada") || newIdeas.some((i) => i.eventId === n.eventId)) continue;
      try {
        const r = await askClaude({ apiKey: aiKey, task: "ideas", context: buildContext({ ...s, ideas: [...newIdeas, ...s.ideas] }), payload: { count: 4, eventTitle: n.eventTitle, eventNote: n.eventNote } });
        if (r.ok) { const made = (r.data.ideas as AiIdea[]).map((a) => toIdea(s, a, "ia", n.eventId, today)); newIdeas.push(...made); generated += made.length; n.lines[0] = `La IA preparó ${made.length} ideas de videos.`; }
      } catch { /* si falla la IA, el aviso sale sin ideas preparadas */ }
    }
  }

  // Ideas del día: una tanda nueva (5 por defecto) cada mañana, con ángulos que rotan, aunque nadie abra la app.
  let dailyMade: ReturnType<typeof toIdea>[] = [];
  if (aiKey && s.prefs.autoDaily && s.ai.lastIdeasDay !== today) {
    try {
      const r = await askClaude({ apiKey: aiKey, task: "ideas", context: buildContext({ ...s, ideas: [...newIdeas, ...s.ideas] }), payload: { count: s.prefs.ideasPerDay || 5 } });
      if (r.ok) { dailyMade = (r.data.ideas as AiIdea[]).map((a) => toIdea(s, a, "ia", undefined, today)); newIdeas.push(...dailyMade); generated += dailyMade.length; }
    } catch { /* sin IA no hay tanda del día */ }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;
  const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, vapidPriv = process.env.VAPID_PRIVATE_KEY;
  if (vapidPub && vapidPriv) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:marketing@fundigsac.com", vapidPub, vapidPriv);

  const log: DeliveryLog[] = [...(s.deliveryLog ?? [])];
  const results: { key: string; email: string; push: string }[] = [];
  for (const n of todo) {
    let email = "omitido", push = "omitido";
    if (s.prefs.email && resend && emails.length) {
      const prev = log.find((l) => l.key === n.key && l.channel === "email");
      const { error: err } = await resend.emails.send({ from: process.env.RESEND_FROM || "FUNDIGSAC <onboarding@resend.dev>", to: emails, subject: n.subject, html: emailHtml(n, creator?.name ?? "Fabrizio") });
      const entry: DeliveryLog = { key: n.key, at: new Date().toISOString(), channel: "email", to: emails.join(", "), status: err ? "error" : "enviado", error: err?.message, attempts: (prev?.attempts ?? 0) + 1 };
      if (prev) Object.assign(prev, entry); else log.push(entry);
      email = entry.status;
    }
    if (s.prefs.push && vapidPub && vapidPriv && s.prefs.pushSubs?.length) {
      let ok = 0, fail = 0;
      for (const sub of s.prefs.pushSubs) { try { await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title: n.subject, body: n.heading, url: n.link })); ok++; } catch { fail++; } }
      const prevP = log.find((l) => l.key === n.key && l.channel === "push");
      const entry: DeliveryLog = { key: n.key, at: new Date().toISOString(), channel: "push", to: `${ok} dispositivo(s)`, status: ok ? "enviado" : "error", error: fail ? `${fail} fallaron` : undefined, attempts: (prevP?.attempts ?? 0) + 1 };
      if (prevP) Object.assign(prevP, entry); else log.push(entry);
      push = entry.status;
    }
    results.push({ key: n.key, email, push });
  }

  // Push de las ideas del día (una sola vez por día).
  const dailyKey = `ideas-${today}`;
  if (dailyMade.length && s.prefs.push && vapidPub && vapidPriv && s.prefs.pushSubs?.length && !log.some((l) => l.key === dailyKey && l.channel === "push" && l.status === "enviado")) {
    let ok = 0, fail = 0;
    const body = dailyMade.slice(0, 3).map((i) => i.title).join(" · ");
    for (const sub of s.prefs.pushSubs) { try { await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title: `${dailyMade.length} ideas nuevas para hoy`, body, url: "/ideas" })); ok++; } catch { fail++; } }
    log.push({ key: dailyKey, at: new Date().toISOString(), channel: "push", to: `${ok} dispositivo(s)`, status: ok ? "enviado" : "error", error: fail ? `${fail} fallaron` : undefined, attempts: 1 });
  }

  // Guarda solo ideas nuevas y el registro de envíos, sin pisar lo que el equipo cambió mientras tanto.
  const { data: fresh } = await sb.from("workspace_state").select("data").eq("id", "main").maybeSingle();
  if (fresh) {
    const f = toV3(fresh.data);
    await sb.from("workspace_state").update({ data: { ...f, ideas: [...newIdeas, ...f.ideas], deliveryLog: log.slice(-400), ai: { ...f.ai, lastIdeasDay: generated ? today : f.ai.lastIdeasDay } } }).eq("id", "main");
  }
  return NextResponse.json({ ok: true, today, hour, due: todo.length, ideasGenerated: generated, emailConfigured: !!resend, pushConfigured: !!(vapidPub && vapidPriv), recipients: emails.length, results });
}
