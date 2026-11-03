"use client";

import { getState, update } from "./store";
import { callAI, templateIdeas, toIdeaBody } from "./ai-client";
import type { FileItem, State } from "./types";
import { guessKind, putFile } from "./files";
import { addDays, todayLima, uid } from "./utils";
import type { Idea, IdeaBody, IdeaStatus, Task, TaskStatus } from "./types";
import { TASK_COLUMNS } from "./types";

const nowISO = () => new Date().toISOString();

export function addTask(t: Partial<Task> & { title: string }, byId: string): string {
  const id = uid();
  update((s) => {
    s.tasks.push({
      id, title: t.title, description: t.description, status: t.status ?? "pendiente", priority: t.priority ?? "media",
      assigneeId: t.assigneeId, due: t.due, productId: t.productId, contentType: t.contentType, ideaId: t.ideaId,
      campaignId: t.campaignId, eventId: t.eventId, attachments: [], comments: [], checklist: t.checklist ?? [],
      history: [{ at: nowISO(), byId, to: t.status ?? "pendiente" }], createdAt: nowISO(),
    });
    if (t.eventId) s.events.find((e) => e.id === t.eventId)?.taskIds.push(id);
  }, `Creó la tarea "${t.title}"`);
  return id;
}

export function moveTask(id: string, to: TaskStatus, byId: string) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t || t.status === to) return;
    // Un video no se aprueba con correcciones obligatorias pendientes.
    if (to === "aprobado") {
      const v = s.videos.find((x) => x.taskId === id);
      if (v && v.notes.some((n) => n.mandatory && !n.resolved)) return;
    }
    t.history.push({ at: nowISO(), byId, from: t.status, to });
    t.status = to;
  }, `Movió una tarea a "${TASK_COLUMNS.find((c) => c.id === to)?.label}"`);
}

export function blockedByVideo(taskId: string, pending: boolean) { return pending && !!taskId; }

export function setIdeaStatus(id: string, status: IdeaStatus, byId: string, note?: string) {
  update((s) => {
    const i = s.ideas.find((x) => x.id === id);
    if (!i) return;
    i.status = status;
    i.decisions.push({ at: nowISO(), by: byId, text: note ?? `Estado: ${status}` });
  }, `Idea "${getState().ideas.find((i) => i.id === id)?.title ?? ""}" → ${status}`);
}

export function saveIdeas(bodies: IdeaBody[], source: Idea["source"], eventId?: string) {
  update((s) => {
    for (const b of bodies) {
      const idea: Idea = { ...b, id: uid(), status: "propuesta", eventId, source, createdAt: nowISO(), versions: [{ v: 1, at: nowISO(), body: b, note: "Versión inicial" }], messages: [], decisions: [] };
      s.ideas.unshift(idea);
      if (eventId) s.events.find((e) => e.id === eventId)?.ideaIds.push(idea.id);
    }
    s.ai.lastIdeasDay = todayLima();
  }, `Se agregaron ${bodies.length} ideas`);
}

/** Convierte una idea elegida en tareas de producción asignadas al equipo. */
export function createTasksFromIdea(ideaId: string, assigneeId: string | undefined, byId: string) {
  update((s) => {
    const idea = s.ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    const base = idea.date && idea.date >= todayLima() ? idea.date : addDays(todayLima(), 7);
    const steps: { title: string; offset: number; status: TaskStatus }[] = [
      { title: `Guion y recursos · ${idea.title}`, offset: -5, status: "pendiente" },
      { title: `Producción · ${idea.title}`, offset: -3, status: "pendiente" },
      { title: `Revisión y ajustes · ${idea.title}`, offset: -1, status: "pendiente" },
    ];
    for (const st of steps) {
      const id = uid();
      s.tasks.push({
        id, title: st.title, status: st.status, priority: idea.priority, assigneeId, due: addDays(base, st.offset),
        productId: idea.productId, contentType: idea.contentType, ideaId, eventId: idea.eventId, description: idea.script,
        attachments: [], comments: [], checklist: [], history: [{ at: nowISO(), byId, to: st.status }], createdAt: nowISO(),
      });
      if (idea.eventId) s.events.find((e) => e.id === idea.eventId)?.taskIds.push(id);
    }
    if (["propuesta", "en_debate", "elegida"].includes(idea.status)) idea.status = "en_preparacion";
    idea.decisions.push({ at: nowISO(), by: byId, text: "Pasó a preparación con 3 tareas asignadas" });
  }, "Convirtió una idea en tareas de producción");
}

export type GenResult = { ok: true; source: "ia" | "plantilla"; n: number; note?: string } | { ok: false; error: string };

/** Genera ideas con Claude Haiku; si la IA no está conectada, usa plantillas locales y lo indica. */
export async function generateIdeas(s: State, opts: { count: number; productId?: string; eventId?: string; allowFallback?: boolean }): Promise<GenResult> {
  const focus = opts.productId ? s.products.find((p) => p.id === opts.productId)?.name : undefined;
  const r = await callAI<{ ideas: Parameters<typeof toIdeaBody>[1][] }>(s, "ideas", { count: opts.count, productFocus: focus, fresh: true });
  if (r.ok) {
    saveIdeas(r.data.ideas.map((a) => toIdeaBody(s, a)), "ia", opts.eventId);
    return { ok: true, source: "ia", n: r.data.ideas.length };
  }
  if (opts.allowFallback !== false && ["IA_NO_CONFIGURADA", "SIN_CONEXION"].includes(r.code)) {
    const t = templateIdeas(s, opts.count, opts.productId);
    saveIdeas(t, "plantilla", opts.eventId);
    return { ok: true, source: "plantilla", n: t.length, note: "La IA no está conectada: se usaron plantillas locales." };
  }
  return { ok: false, error: r.error };
}

/** Guarda archivos en el navegador y los registra en la biblioteca. */
export async function uploadFiles(list: FileList | File[], byId: string, opts: { kind?: FileItem["kind"]; productId?: string } = {}): Promise<FileItem[]> {
  const out: FileItem[] = [];
  for (const f of Array.from(list)) {
    const item: FileItem = { id: uid(), name: f.name, mime: f.type, size: f.size, kind: opts.kind ?? guessKind(f.type, f.name), productId: opts.productId, addedAt: nowISO(), byId };
    await putFile(item.id, f);
    out.push(item);
  }
  update((s) => { s.files.unshift(...out); }, `Subió ${out.length} archivo(s)`);
  return out;
}
