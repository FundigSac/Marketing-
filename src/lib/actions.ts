"use client";

import { callAI, templateIdeas, toIdea } from "./ai-client";
import { putFile } from "./files";
import { getState, update } from "./store";
import { addDays, todayLima, uid } from "./utils";
import { COLUMNS, type Column, type Idea, type State, type Task } from "./types";

const nowISO = () => new Date().toISOString();
const label = (c: Column) => COLUMNS.find((x) => x.id === c)!.label;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const CHECKLIST = ["Guion aprobado", "Material grabado", "Edición terminada", "Audio y subtítulos revisados", "Logo y contacto comercial incluidos"];

export function addTask(t: Partial<Task> & { title: string }, byId: string): string {
  const id = uid();
  update((s) => {
    s.tasks.push({
      id, title: t.title, description: t.description, status: t.status ?? "todo", priority: t.priority ?? "media", due: t.due,
      ideaId: t.ideaId, eventId: t.eventId, platform: t.platform, productId: t.productId, duration: t.duration,
      checklist: t.checklist ?? CHECKLIST.map((text) => ({ id: uid(), text, done: false })),
      comments: [], files: [], notes: [], history: [{ at: nowISO(), byId, to: t.status ?? "todo" }], createdAt: nowISO(),
    });
  }, `Creó el video "${t.title}"`);
  return id;
}

type Result = { ok: true } | { ok: false; error: string };

/** Reglas: solo el revisor aprueba; no se aprueba con correcciones obligatorias pendientes ni sin video; solo se publica lo aprobado; a revisión solo con un avance adjunto. */
export function moveTask(id: string, to: Column, byId: string): Result {
  const s = getState();
  const t = s.tasks.find((x) => x.id === id);
  const me = s.users.find((u) => u.id === byId);
  if (!t || !me) return { ok: false, error: "Video no encontrado." };
  if (t.status === to) return { ok: true };
  if (to === "aprobado" && me.role !== "reviewer") return { ok: false, error: "Solo el revisor puede aprobar un video." };
  if (to === "aprobado") {
    const pending = t.notes.filter((n) => n.mandatory && !n.resolved).length;
    if (pending) return { ok: false, error: `No se puede aprobar: hay ${pending} corrección(es) obligatoria(s) pendiente(s).` };
    if (!t.files.length) return { ok: false, error: "No se puede aprobar sin un video adjunto." };
  }
  if (to === "revision" && !t.files.length) return { ok: false, error: "Sube un avance antes de enviarlo a revisión." };
  if (to === "publicado" && t.status !== "aprobado") return { ok: false, error: "Solo se publica un video aprobado." };
  update((st) => {
    const x = st.tasks.find((y) => y.id === id)!;
    x.history.push({ at: nowISO(), byId, from: x.status, to });
    x.status = to;
    if (to === "revision") { x.changes = false; if (!x.deliveredAt) x.deliveredAt = nowISO(); }
    if (to === "aprobado") { x.approvedAt = nowISO(); x.changes = false; }
    if (to === "publicado") x.publishedAt = nowISO();
    if (x.ideaId && to !== "todo") { const i = st.ideas.find((q) => q.id === x.ideaId); if (i && i.status !== "descartada") i.status = "en_produccion"; }
  }, `Movió "${t.title}" a ${label(to)}`);
  return { ok: true };
}

/** El revisor pide correcciones: el video vuelve a edición con aviso de cambios. */
export function requestChanges(id: string, byId: string): Result {
  const s = getState();
  const t = s.tasks.find((x) => x.id === id);
  const me = s.users.find((u) => u.id === byId);
  if (!t || !me) return { ok: false, error: "Video no encontrado." };
  if (me.role !== "reviewer") return { ok: false, error: "Solo el revisor pide correcciones." };
  if (!t.notes.some((n) => !n.resolved) && !t.comments.some((c) => c.byId === byId)) return { ok: false, error: "Deja al menos una observación o comentario antes de pedir correcciones." };
  update((st) => {
    const x = st.tasks.find((y) => y.id === id)!;
    x.history.push({ at: nowISO(), byId, from: x.status, to: "edicion" });
    x.status = "edicion"; x.changes = true;
  }, `Pidió correcciones en "${t.title}"`);
  return { ok: true };
}

/** Adjunta un video/archivo de avance como nueva versión. */
export async function attachFile(taskId: string, file: File, byId: string) {
  const fid = uid();
  await putFile(fid, file);
  update((s) => {
    const t = s.tasks.find((x) => x.id === taskId)!;
    t.files.push({ id: fid, name: file.name, version: t.files.length + 1, at: nowISO(), byId });
    if (t.status === "todo") { t.history.push({ at: nowISO(), byId, from: "todo", to: "edicion" }); t.status = "edicion"; }
  }, `Adjuntó un avance a "${getState().tasks.find((x) => x.id === taskId)?.title}"`);
  return fid;
}

/** Guarda ideas evitando repetidas (mismo título normalizado que una existente o descartada). */
export function saveIdeas(ideas: Idea[]) {
  let added = 0;
  update((s) => {
    const seen = new Set(s.ideas.map((i) => norm(i.title)));
    const fresh = ideas.filter((i) => { const k = norm(i.title); if (seen.has(k)) return false; seen.add(k); return true; });
    added = fresh.length;
    s.ideas.unshift(...fresh);
    s.ai.lastIdeasDay = todayLima();
  }, `Se agregaron ${ideas.length} ideas`);
  return added;
}

/** Convierte una idea en un video del tablero (columna "Por hacer"). */
export function ideaToTask(ideaId: string, byId: string): string | null {
  const s = getState();
  const i = s.ideas.find((x) => x.id === ideaId);
  if (!i) return null;
  const existing = s.tasks.find((t) => t.ideaId === ideaId);
  if (existing) return existing.id;
  const ev = i.eventId ? s.events.find((e) => e.id === i.eventId) : undefined;
  const due = i.date && i.date >= todayLima() ? addDays(i.date, -1) : addDays(todayLima(), 10);
  const id = addTask({ title: i.title, description: i.script, ideaId: i.id, eventId: ev?.id, platform: i.platform, productId: i.productId, duration: i.duration, due, priority: ev?.relevance === "alta" ? "alta" : "media" }, byId);
  update((st) => { const x = st.ideas.find((q) => q.id === ideaId)!; x.status = "en_produccion"; x.favorite = true; }, `Convirtió la idea "${i.title}" en video`);
  return id;
}

/** Programa la publicación: crea el video (entrega el día anterior) y el evento de publicación con recordatorios. */
export function scheduleIdea(ideaId: string, date: string, byId: string) {
  const taskId = ideaToTask(ideaId, byId);
  update((st) => {
    const i = st.ideas.find((x) => x.id === ideaId)!;
    const t = st.tasks.find((x) => x.id === taskId);
    if (t) t.due = addDays(date, -1);
    i.date = date;
    st.events = st.events.filter((e) => !(e.category === "publicacion" && e.taskId === taskId));
    st.events.push({ id: uid(), title: `Publicar: ${i.title}`, category: "publicacion", start: date, allDay: true, repeat: "none", reminders: [3, 1], relevance: "alta", source: "manual", taskId: taskId ?? undefined, description: `${i.platform} · ${i.duration}` });
  }, "Programó la publicación de una idea");
  return taskId;
}

export type GenResult = { ok: true; source: "ia" | "plantilla"; n: number; note?: string } | { ok: false; error: string };

/** Genera ideas con Claude Haiku; si no hay IA conectada, usa plantillas locales y lo avisa. */
export async function generateIdeas(s: State, opts: { count: number; eventId?: string; productId?: string; date?: string; allowFallback?: boolean }): Promise<GenResult> {
  const ev = opts.eventId ? s.events.find((e) => e.id === opts.eventId) : undefined;
  const product = opts.productId ? s.products.find((p) => p.id === opts.productId)?.name : undefined;
  const r = await callAI<{ ideas: Parameters<typeof toIdea>[1][] }>(s, "ideas", { count: opts.count, eventTitle: ev?.title ?? (opts.date ? `Publicación para el ${opts.date}` : undefined), eventNote: ev?.relevanceNote, productFocus: product, fresh: true });
  if (r.ok) {
    const batch = todayLima();
    const n = saveIdeas(r.data.ideas.map((a) => { const i = toIdea(s, a, "ia", opts.eventId, batch); if (opts.date && !i.date) i.date = opts.date; return i; }));
    return { ok: true, source: "ia", n, note: n < r.data.ideas.length ? `${r.data.ideas.length - n} repetida(s) descartada(s)` : undefined };
  }
  if (opts.allowFallback !== false && ["IA_NO_CONFIGURADA", "SIN_CONEXION"].includes(r.code)) {
    const t = templateIdeas(s, opts.count, opts.eventId);
    if (opts.date) t.forEach((i) => { if (!i.date) i.date = opts.date; });
    const n = saveIdeas(t);
    return { ok: true, source: "plantilla", n, note: "La IA no está conectada: se usaron plantillas locales." };
  }
  return { ok: false, error: r.error };
}
