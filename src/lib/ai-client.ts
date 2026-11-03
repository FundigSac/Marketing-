"use client";

import { addDays, todayLima, uid } from "./utils";
import { totals, upcomingEvents } from "./domain";
import { update } from "./store";
import type { Idea, IdeaBody, State } from "./types";

export type AiResult<T> = { ok: true; data: T; cached: boolean } | { ok: false; code: string; error: string };

/** Contexto compacto y verificable que se envía a la IA. Solo datos cargados por el equipo. */
export function buildContext(s: State) {
  const today = todayLima();
  const m = totals(s.metrics);
  return {
    hoy: today,
    zonaHoraria: "America/Lima",
    productos: s.products.map((p) => ({ nombre: p.name, hdpe: p.hdpe, prioritario: p.priority, disponibilidad: p.availability, especificacionesVerificadas: p.specs || "por confirmar", argumentoComercial: p.pitch || "" })),
    fechasProximas: upcomingEvents(s.events, today, 60).slice(0, 12).map((u) => ({ titulo: u.e.title, fecha: u.date, enDias: u.in, categoria: u.e.category, relevancia: u.e.relevance, nota: u.e.relevanceNote })),
    ideasExistentes: s.ideas.slice(0, 40).map((i) => ({ titulo: i.title, estado: i.status })),
    tareas: s.tasks.slice(0, 40).map((t) => ({ titulo: t.title, estado: t.status, vence: t.due, responsable: s.users.find((u) => u.id === t.assigneeId)?.name })),
    campanas: s.campaigns.map((c) => ({ nombre: c.name, estado: c.status, presupuestoPEN: c.budget, inicio: c.start, fin: c.end })),
    resultadosRegistrados: s.metrics.length ? m : "sin datos registrados",
    contactoComercial: s.company.salesPhones.filter((p) => p.number).map((p) => `${p.label}: ${p.number}`),
    fechaLimiteTrabajo: addDays(today, 7),
  };
}

export async function callAI<T>(s: State, task: string, payload: Record<string, unknown> = {}, withContext = true): Promise<AiResult<T>> {
  try {
    const r = await fetch("/api/ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, payload, context: withContext ? buildContext(s) : undefined }),
    });
    const j = await r.json();
    if (j.ok) {
      const d = todayLima();
      update((st) => { st.ai.calls[d] = (st.ai.calls[d] ?? 0) + 1; });
    }
    return j;
  } catch {
    return { ok: false, code: "SIN_CONEXION", error: "No se pudo contactar al servidor." };
  }
}

type AiIdea = { title: string; date: string; productName: string; objective: string; network: string; contentType: string; visual: string; script: string; resources: string; why: string; priority: "alta" | "media" | "baja" };

export const toIdeaBody = (s: State, a: AiIdea): IdeaBody => ({
  title: a.title, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : undefined,
  productId: s.products.find((p) => p.name.toLowerCase() === a.productName.toLowerCase())?.id,
  objective: a.objective, network: a.network, contentType: a.contentType, visual: a.visual, script: a.script,
  resources: a.resources, why: a.why, priority: a.priority,
});

export function newIdea(body: IdeaBody, source: Idea["source"], eventId?: string): Idea {
  return { ...body, id: uid(), status: "propuesta", eventId, source, createdAt: new Date().toISOString(), versions: [{ v: 1, at: new Date().toISOString(), body, note: "Versión inicial" }], messages: [], decisions: [] };
}

export const hasKeyHint = "Define ANTHROPIC_API_KEY en .env.local (o en Vercel) y reinicia el servidor.";

/** Plantillas locales: respaldo cuando la IA no está conectada. No inventan medidas, precios ni descuentos. */
export function templateIdeas(s: State, count: number, focus?: string): IdeaBody[] {
  const today = todayLima();
  const ev = upcomingEvents(s.events, today, 45).find((u) => u.e.relevance === "alta" || u.e.relevance === "media");
  const pool = (focus ? s.products.filter((p) => p.id === focus) : s.products.filter((p) => p.priority)).concat(s.products);
  const used = new Set(s.ideas.map((i) => i.title));
  const T: ((p: string) => Omit<IdeaBody, "productId">)[] = [
    (p) => ({ title: `Video corto: ${p} en acción`, objective: "Generar consultas de cotización", network: "TikTok / Instagram", contentType: "Video corto", visual: `Primeros planos de un ${p} real sobre fondo limpio.`, script: `Gancho: "Así se ve un ${p} de cerca". Solo características verificadas por el equipo. Cierre: invitación a cotizar.`, resources: "Producto físico, buena iluminación, logo, contacto de ventas", why: "Mostrar el producto real genera confianza.", priority: "alta" }),
    (p) => ({ title: `Publicación educativa: ${p}`, objective: "Posicionar a la empresa como especialista", network: "LinkedIn / Facebook", contentType: "Carrusel", visual: "4–5 láminas: pregunta, explicación simple, uso, contacto.", script: `Explica para qué sirve el ${p}. Cada dato técnico debe estar por confirmar con el equipo antes de publicar.`, resources: "Fotos reales, validación técnica del equipo", why: "El contenido que enseña atrae a compradores técnicos.", priority: "media" }),
    (p) => ({ title: `Producto disponible: ${p}`, objective: "Generar mensajes y cotizaciones", network: "Facebook / WhatsApp", contentType: "Imagen", visual: "Foto real del producto con logo y contacto de ventas.", script: `"${p}: consulta disponibilidad y cotiza." Confirmar stock antes de publicar.`, resources: "Foto real, confirmación de stock, número de ventas", why: "Mensaje directo orientado a la consulta.", priority: "media" }),
  ];
  const out: IdeaBody[] = [];
  let i = 0;
  while (out.length < count && i < 60) {
    const p = pool[(Math.floor(Math.random() * pool.length) + i) % pool.length];
    const t = T[i % T.length](p.name);
    if (!used.has(t.title) && !out.some((o) => o.title === t.title)) out.push({ ...t, productId: p.id });
    i++;
  }
  if (ev && out[0] && out.length >= 2) {
    out[out.length - 1] = { title: `${ev.e.title}: conexión con nuestra actividad`, date: ev.date, productId: pool[0]?.id, objective: "Presencia de marca en una fecha cercana", network: "Instagram / Facebook", contentType: "Imagen", visual: `Imagen sobria alusiva a ${ev.e.title} con la marca.`, script: `Saludo institucional por ${ev.e.title}. Úsalo solo si hay una conexión razonable con la empresa.`, resources: "Diseño con logo", why: ev.e.relevanceNote || "Aprovecha una fecha cercana sin forzar la venta.", priority: "baja" };
  }
  return out;
}
