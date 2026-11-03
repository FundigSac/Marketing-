import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { computeDue, emailHtml, inQuietHours, limaHour, limaToday, pending } from "@/lib/reminders";
import type { DeliveryLog, State } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Tarea programada (Vercel Cron). Funciona con el navegador cerrado.
 * Lee el estado compartido de Supabase, calcula avisos del día (America/Lima), envía correo (Resend) y
 * push (Web Push), evita duplicados por clave y reintenta los fallos hasta 3 veces.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await sb.from("workspace_state").select("data").eq("id", "main").maybeSingle();
  if (error || !row) return NextResponse.json({ ok: false, error: error?.message ?? "Sin datos" }, { status: 500 });
  const s = row.data as State;

  const now = new Date(), today = limaToday(now), hour = limaHour(now);
  if (inQuietHours(s.prefs.quiet, hour)) return NextResponse.json({ ok: true, skipped: "horario de silencio", hour });

  const todo = pending(computeDue(s, today, hour), s.deliveryLog ?? []);
  const emails = [...new Set([...(s.prefs.recipients ?? []), ...s.users.filter((u) => u.active && u.email).map((u) => u.email)])].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;
  const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, vapidPriv = process.env.VAPID_PRIVATE_KEY;
  if (vapidPub && vapidPriv) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:marketing@fundigsac.com", vapidPub, vapidPriv);

  const log: DeliveryLog[] = [...(s.deliveryLog ?? [])];
  const results: { key: string; email: string; push: string }[] = [];

  for (const n of todo) {
    const prev = log.find((l) => l.key === n.key && l.channel === "email");
    let email = "omitido";
    if (s.prefs.email && resend && emails.length) {
      const { error: err } = await resend.emails.send({ from: process.env.RESEND_FROM || "FUNDIGSAC <onboarding@resend.dev>", to: emails, subject: n.subject, html: emailHtml(n) });
      const entry: DeliveryLog = { key: n.key, at: new Date().toISOString(), channel: "email", to: emails.join(", "), status: err ? "error" : "enviado", error: err?.message, attempts: (prev?.attempts ?? 0) + 1 };
      if (prev) Object.assign(prev, entry); else log.push(entry);
      email = entry.status;
    }
    let push = "omitido";
    if (s.prefs.push && vapidPub && vapidPriv && s.prefs.pushSubs?.length) {
      let ok = 0, fail = 0;
      for (const sub of s.prefs.pushSubs) {
        try { await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title: n.subject, body: n.heading, url: n.link })); ok++; } catch { fail++; }
      }
      const prevP = log.find((l) => l.key === n.key && l.channel === "push");
      const entry: DeliveryLog = { key: n.key, at: new Date().toISOString(), channel: "push", to: `${ok} dispositivo(s)`, status: ok ? "enviado" : "error", error: fail ? `${fail} fallaron` : undefined, attempts: (prevP?.attempts ?? 0) + 1 };
      if (prevP) Object.assign(prevP, entry); else log.push(entry);
      push = entry.status;
    }
    results.push({ key: n.key, email, push });
  }

  // Guarda solo el registro de envíos para no pisar cambios que hizo el equipo mientras tanto.
  const { data: fresh } = await sb.from("workspace_state").select("data").eq("id", "main").maybeSingle();
  if (fresh) await sb.from("workspace_state").update({ data: { ...(fresh.data as State), deliveryLog: log.slice(-400) } }).eq("id", "main");

  return NextResponse.json({ ok: true, today, hour, due: todo.length, emailConfigured: !!resend, pushConfigured: !!(vapidPub && vapidPriv), recipients: emails.length, results });
}
