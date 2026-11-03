import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { emailHtml } from "@/lib/reminders";

export const runtime = "nodejs";

/** Envío de prueba real (correo o push). Si faltan credenciales responde 503: no simula el envío. */
export async function POST(req: NextRequest) {
  const { kind, to, subscription } = (await req.json().catch(() => ({}))) as { kind?: string; to?: string[]; subscription?: webpush.PushSubscription };
  const notice = { key: "test", category: "digest" as const, subject: "FUNDIGSAC | Correo de prueba", heading: "Este es un aviso de prueba del sistema.", lines: ["Si lo recibiste, los correos reales están funcionando."], link: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" };

  if (kind === "email") {
    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ ok: false, code: "EMAIL_NO_CONFIGURADO", error: "Falta RESEND_API_KEY en el servidor." }, { status: 503 });
    const list = (to ?? []).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).slice(0, 10);
    if (!list.length) return NextResponse.json({ ok: false, code: "SIN_DESTINATARIOS", error: "Agrega al menos un correo real." }, { status: 400 });
    const { error } = await new Resend(key).emails.send({ from: process.env.RESEND_FROM || "FUNDIGSAC <onboarding@resend.dev>", to: list, subject: notice.subject, html: emailHtml(notice) });
    return error ? NextResponse.json({ ok: false, code: "ERROR_PROVEEDOR", error: error.message }, { status: 502 }) : NextResponse.json({ ok: true, sentTo: list.length });
  }
  if (kind === "push") {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return NextResponse.json({ ok: false, code: "PUSH_NO_CONFIGURADO", error: "Faltan las claves VAPID en el servidor." }, { status: 503 });
    if (!subscription) return NextResponse.json({ ok: false, code: "SIN_SUSCRIPCION", error: "Este dispositivo no está suscrito." }, { status: 400 });
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:marketing@fundigsac.com", pub, priv);
      await webpush.sendNotification(subscription, JSON.stringify({ title: "FUNDIGSAC", body: "Aviso push de prueba", url: "/" }));
      return NextResponse.json({ ok: true });
    } catch (e) { return NextResponse.json({ ok: false, code: "ERROR_PUSH", error: (e as Error).message }, { status: 502 }); }
  }
  return NextResponse.json({ ok: false, code: "SOLICITUD_INVALIDA", error: "kind debe ser email o push." }, { status: 400 });
}
