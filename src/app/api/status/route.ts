import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Qué servicios tienen credenciales configuradas (nunca devuelve los valores). */
export async function GET() {
  return NextResponse.json({
    ia: { configured: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5" },
    supabase: { configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    email: { configured: !!process.env.RESEND_API_KEY, from: process.env.RESEND_FROM || "FUNDIGSAC <onboarding@resend.dev> (remitente de prueba)" },
    push: { configured: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null },
    cron: { configured: !!process.env.CRON_SECRET },
  });
}
