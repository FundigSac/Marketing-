import { daysBetween, fmtDate } from "./utils";
import { isOverdue, upcomingEvents } from "./domain";
import type { State } from "./types";

export type Alert = { id: string; level: "alta" | "media" | "info"; title: string; body: string; href: string };

/** Avisos calculados en vivo a partir de los datos (no se guardan). */
export function deriveAlerts(s: State, today: string): Alert[] {
  const out: Alert[] = [];
  for (const t of s.tasks) {
    if (isOverdue(t, today)) out.push({ id: "t" + t.id, level: "alta", title: "Tarea atrasada", body: `${t.title} · venció ${fmtDate(t.due)}`, href: `/produccion/tareas/${t.id}` });
  }
  for (const d of s.deliverables) {
    if (!d.receivedAt && d.dueAt.slice(0, 10) < today) out.push({ id: "d" + d.id, level: "alta", title: "Entregable vencido sin recibir", body: `${d.title} · era para ${fmtDate(d.dueAt)}`, href: "/produccion/entregables" });
    else if (!d.receivedAt && daysBetween(today, d.dueAt) <= 2) out.push({ id: "dp" + d.id, level: "media", title: "Entrega próxima", body: `${d.title} · ${fmtDate(d.dueAt)}`, href: "/produccion/entregables" });
    else if (d.receivedAt && d.receivedAt.slice(0, 10) === today) out.push({ id: "dr" + d.id, level: "info", title: "Entregable recibido", body: d.title, href: "/produccion/entregables" });
  }
  for (const u of upcomingEvents(s.events, today, 14)) {
    if (u.e.relevance === "alta" || u.in <= 3) out.push({ id: "e" + u.e.id + u.date, level: u.in <= 3 ? "media" : "info", title: u.in === 0 ? "Fecha de hoy" : `Fecha en ${u.in} días`, body: u.e.title, href: `/eventos/${u.e.id}` });
  }
  for (const v of s.videos) {
    if (v.status === "pendiente" || v.status === "en_revision") out.push({ id: "v" + v.id, level: "media", title: "Video por revisar", body: v.title, href: `/produccion/videos/${v.id}` });
  }
  return out;
}
