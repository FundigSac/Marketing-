import { seedState } from "./seed";
import type { Column, EventCategory, EventItem, Idea, IdeaStatus, State, Task } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type V2 = Record<string, any>;

const EVENT_CAT: Record<string, EventCategory> = { peru: "peru", industria: "industria", comercial: "comercial", marketing: "personal", entrega: "entrega", grabacion: "personal", revision: "personal", publicacion: "publicacion" };
const IDEA_STATUS: Record<string, IdeaStatus> = { propuesta: "nueva", en_debate: "nueva", elegida: "elegida", en_preparacion: "en_produccion", en_revision: "en_produccion", aprobada: "en_produccion", programada: "en_produccion", publicada: "en_produccion", descartada: "descartada" };
const COLUMN: Record<string, Column> = { pendiente: "todo", produccion: "edicion", cambios: "edicion", entregado: "revision", revision: "revision", aprobado: "aprobado", programado: "aprobado", publicado: "publicado", analizado: "publicado" };

/** Convierte los datos del sistema anterior (v2, 28 pantallas) al modelo de 4 secciones sin perder nada:
 *  lo que no se muestra (campañas, métricas, consultas, entregables, archivos…) queda guardado en `legacy`. */
export function migrateV2(old: V2): State {
  const base = seedState();
  const users = (old.users ?? []).filter((u: any) => u.role === "admin" || u.role === "marketing").map((u: any) => ({ id: u.id, name: u.name, email: u.email ?? "", role: u.role === "admin" ? "reviewer" : "creator", active: u.active !== false }));
  const videosByTask = new Map<string, any>((old.videos ?? []).filter((v: any) => v.taskId).map((v: any) => [v.taskId, v]));

  const events: EventItem[] = (old.events ?? []).map((e: any) => ({
    id: e.id, title: e.title, description: e.description, category: EVENT_CAT[e.category] ?? "personal", start: e.start, end: e.end, allDay: e.allDay !== false,
    repeat: e.repeat, repeatInterval: e.repeatInterval, repeatUntil: e.repeatUntil, reminders: e.reminders ?? [7, 1], relevance: e.relevance ?? "media", relevanceNote: e.relevanceNote, source: e.source === "sugerida" ? "sugerida" : "manual",
  }));

  const ideas: Idea[] = (old.ideas ?? []).map((i: any) => ({
    id: i.id, title: i.title, concept: i.visual || i.objective || "", script: i.script ?? "", productId: i.productId, duration: "por definir", platform: i.network || "Por definir", why: i.why ?? "",
    eventId: i.eventId, date: i.date, favorite: false, status: IDEA_STATUS[i.status] ?? "nueva", source: i.source === "plantilla" ? "plantilla" : "ia", createdAt: i.createdAt ?? new Date().toISOString(),
    versions: (i.versions ?? []).map((v: any) => ({ v: v.v, at: v.at, note: v.note ?? "", script: v.body?.script ?? "", concept: v.body?.visual ?? "" })),
    messages: i.messages ?? [],
  }));

  const tasks: Task[] = (old.tasks ?? []).map((t: any) => {
    const video = videosByTask.get(t.id);
    const files = [
      ...(video?.versions ?? []).map((v: any) => ({ id: v.fileId, name: `avance-v${v.v}`, version: v.v, at: v.at, byId: v.byId ?? t.assigneeId ?? "" })),
      ...(t.attachments ?? []).map((a: any, k: number) => ({ id: a.id, name: a.name, version: (video?.versions?.length ?? 0) + k + 1, at: t.createdAt, byId: t.assigneeId ?? "" })),
    ];
    const lastFile = video?.versions?.[video.versions.length - 1]?.fileId;
    return {
      id: t.id, title: t.title, description: t.description, status: COLUMN[t.status] ?? "todo", priority: t.priority ?? "media", due: t.due, ideaId: t.ideaId, eventId: t.eventId,
      platform: undefined, productId: t.productId, checklist: t.checklist ?? [], comments: t.comments ?? [], files,
      notes: (video?.notes ?? []).map((n: any) => ({ id: n.id, fileId: video.versions?.find((v: any) => v.v === n.version)?.fileId ?? lastFile ?? "", at: n.at, text: n.text, mandatory: n.mandatory !== false, resolved: !!n.resolved, byId: n.byId, createdAt: n.createdAt })),
      history: (t.history ?? []).map((h: any) => ({ at: h.at, byId: h.byId, from: h.from ? COLUMN[h.from] : undefined, to: COLUMN[h.to] ?? "todo" })),
      changes: t.status === "cambios" || undefined, deliveredAt: undefined, createdAt: t.createdAt ?? new Date().toISOString(),
    } as Task;
  });
  // Entrega a revisión: se toma del historial anterior para conservar el cumplimiento.
  for (const t of tasks) { const h = t.history.find((x) => x.to === "revision"); if (h) t.deliveredAt = h.at; const a = t.history.find((x) => x.to === "aprobado"); if (a) t.approvedAt = a.at; const p = t.history.find((x) => x.to === "publicado"); if (p) t.publishedAt = p.at; }

  const keep = ["campaigns", "metrics", "leads", "deliverables", "files", "schedule", "company", "videos", "users", "deliveryLog"];
  const legacy: Record<string, unknown> = { migratedAt: new Date().toISOString(), from: "marketing-os-v2" };
  for (const k of keep) if (old[k] !== undefined) legacy[k] = old[k];

  return {
    ...base,
    users: users.length ? users : base.users,
    events: events.length ? events : base.events, ideas, tasks,
    products: (old.products ?? []).length ? old.products.map((p: any) => ({ id: p.id, name: p.name, specs: p.specs ?? "", notes: p.pitch ?? "" })) : base.products,
    notifs: [], log: old.log ?? [], deliveryLog: old.deliveryLog ?? [],
    prefs: { ...base.prefs, email: old.prefs?.email ?? true, push: old.prefs?.push ?? false, recipients: old.prefs?.recipients ?? [], quiet: old.prefs?.quiet ?? base.prefs.quiet, ideasPerDay: 5, pushSubs: old.prefs?.pushSubs ?? [] },
    ai: old.ai ?? { calls: {} },
    currentUserId: users.find((u: any) => u.name === "Fabrizio")?.id ?? users[0]?.id ?? base.currentUserId,
    legacy,
  };
}

/** Acepta datos v2 o v3 (copia de respaldo o base compartida) y devuelve siempre v3. */
export function toV3(data: any): State {
  if (data?.version === 3) {
    const base = seedState();
    // Los valores anteriores por defecto eran 3 y 4; ahora son 5 ideas por día (se puede subir a 6 en Recordatorios).
    const prefs = { ...base.prefs, ...data.prefs, ideasPerDay: Math.max(5, data.prefs?.ideasPerDay ?? 5) };
    return { ...base, ...data, prefs, version: 3 };
  }
  if (data?.version === 2) return migrateV2(data);
  return seedState();
}
