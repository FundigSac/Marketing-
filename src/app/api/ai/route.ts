import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Anthropic, MODEL, askClaude, instruction } from "@/lib/ai-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 80);
// Caché y límite de consumo en memoria (por instancia del servidor): freno básico de costos.
const cache = new Map<string, { at: number; data: unknown }>();
const usage = new Map<string, { day: string; n: number }>();
const TTL = 60 * 60 * 1000;

type Body = { task: string; context?: unknown; payload?: Record<string, unknown> };
const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, code: "IA_NO_CONFIGURADA", error: "Falta ANTHROPIC_API_KEY en el servidor." }, { status: 503 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "SOLICITUD_INVALIDA", error: "JSON inválido." }, { status: 400 }); }
  if (!body?.task || JSON.stringify(body).length > 120_000) return NextResponse.json({ ok: false, code: "SOLICITUD_INVALIDA", error: "Solicitud inválida o demasiado grande." }, { status: 400 });
  try { instruction(body.task, body.payload ?? {}); } catch { return NextResponse.json({ ok: false, code: "TASK_DESCONOCIDA", error: "Tarea no soportada." }, { status: 400 }); }

  const hash = createHash("sha256").update(JSON.stringify([body.task, body.context, body.payload])).digest("hex");
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < TTL && !(body.payload as { fresh?: boolean } | undefined)?.fresh) return NextResponse.json({ ok: true, cached: true, data: hit.data });

  const today = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip(req));
  const n = u && u.day === today ? u.n : 0;
  if (n >= DAILY_LIMIT) return NextResponse.json({ ok: false, code: "LIMITE_DIARIO", error: `Límite diario de ${DAILY_LIMIT} consultas de IA alcanzado.` }, { status: 429 });

  try {
    const r = await askClaude({ apiKey: key, task: body.task, context: body.context, payload: body.payload ?? {} });
    if (!r.ok) return NextResponse.json({ ok: false, code: r.code, error: r.code === "RECHAZADO" ? "El modelo rechazó la solicitud. Reformúlala." : "La respuesta se cortó. Pide menos elementos." }, { status: 422 });
    usage.set(ip(req), { day: today, n: n + 1 });
    cache.set(hash, { at: Date.now(), data: r.data });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ ok: true, cached: false, data: r.data, usage: r.usage });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ ok: false, code: "CLAVE_INVALIDA", error: "ANTHROPIC_API_KEY inválida." }, { status: 401 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ ok: false, code: "LIMITE_PROVEEDOR", error: "El proveedor de IA limitó las solicitudes. Reintenta en unos minutos." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ ok: false, code: "ERROR_PROVEEDOR", error: `Error del proveedor de IA (${e.status}).` }, { status: 502 });
    return NextResponse.json({ ok: false, code: "ERROR_INTERNO", error: "No se pudo procesar la respuesta de la IA." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: !!process.env.ANTHROPIC_API_KEY, model: MODEL, dailyLimit: DAILY_LIMIT });
}
