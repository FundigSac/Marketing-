"use client";

import { buildContext, toIdea, type AiIdea } from "./context";
import { upcomingEvents } from "./domain";
import { update } from "./store";
import { todayLima } from "./utils";
import type { Idea, State } from "./types";

export { buildContext, toIdea };
export type { AiIdea };

export type AiResult<T> = { ok: true; data: T; cached: boolean } | { ok: false; code: string; error: string };

export async function callAI<T>(s: State, task: string, payload: Record<string, unknown> = {}): Promise<AiResult<T>> {
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, payload, context: buildContext(s) }) });
    const j = await r.json();
    if (j.ok) { const d = todayLima(); update((st) => { st.ai.calls[d] = (st.ai.calls[d] ?? 0) + 1; }); }
    return j;
  } catch { return { ok: false, code: "SIN_CONEXION", error: "No se pudo contactar al servidor." }; }
}

/** Plantillas locales: respaldo cuando la IA no está conectada. No inventan medidas, precios ni promociones. */
export function templateIdeas(s: State, count: number, eventId?: string): Idea[] {
  const today = todayLima();
  const ev = eventId ? s.events.find((e) => e.id === eventId) : upcomingEvents(s.events, today, 45).find((u) => u.e.relevance !== "baja")?.e;
  const used = new Set(s.ideas.map((i) => i.title));
  const prods = s.products.filter((p) => /hdpe/i.test(p.name)).concat(s.products);
  const T: ((p: string) => AiIdea)[] = [
    (p) => ({ title: `${p} de cerca: así se ve en la vida real`, concept: `Primeros planos de un ${p} real, bien iluminado, y cierre invitando a cotizar.`, script: `0–5 s: gancho "Así se ve un ${p} de cerca". 5–20 s: plano del producto girando, solo características verificadas (por confirmar). 20–30 s: "Pide tu cotización".`, productName: p, duration: "30 s", platform: "TikTok", why: "Mostrar el producto real genera confianza.", date: "" }),
    (p) => ({ title: `3 cosas que preguntar antes de comprar ${p}`, concept: "Video educativo con 3 preguntas clave, sin cifras no confirmadas.", script: `0–4 s: "¿Vas a comprar ${p}?" 4–25 s: tres preguntas en pantalla (aplicación, medida, disponibilidad: por confirmar). 25–35 s: "Escríbenos tu proyecto".`, productName: p, duration: "35 s", platform: "Instagram Reels", why: "El contenido que ayuda a decidir atrae compradores técnicos.", date: "" }),
    (p) => ({ title: `Almacén en 20 segundos: ${p} listo para cotizar`, concept: "Recorrido rápido por el almacén mostrando el producto y el contacto de ventas.", script: `0–6 s: entrada al almacén. 6–16 s: ${p} en estante (confirmar stock antes de publicar). 16–20 s: contacto de ventas.`, productName: p, duration: "20 s", platform: "Facebook", why: "Muestra seriedad y cercanía.", date: "" }),
  ];
  const out: Idea[] = [];
  for (let i = 0; out.length < count && i < 60; i++) {
    const p = prods[(i * 2 + Math.floor(Math.random() * prods.length)) % prods.length];
    const a = T[i % T.length](p.name);
    if (!used.has(a.title) && !out.some((o) => o.title === a.title)) out.push(toIdea(s, a, "plantilla", undefined, today));
  }
  if (ev && out.length >= 2) {
    const a: AiIdea = { title: `${ev.title}: un mensaje de FUNDIGSAC`, concept: `Saludo breve ligado a ${ev.title} con el producto como protagonista.`, script: `0–5 s: imagen alusiva a ${ev.title}. 5–15 s: producto en plano limpio. 15–20 s: contacto. Úsalo solo si hay una conexión razonable.`, productName: prods[0]?.name ?? "", duration: "20 s", platform: "Instagram Reels", why: ev.relevanceNote || "Aprovecha una fecha cercana.", date: "" };
    out[out.length - 1] = toIdea(s, a, "plantilla", ev.id, today);
  }
  return out;
}
