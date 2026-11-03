import { daysBetween, fmtDate } from "./utils";
import { isOverdue, upcomingEvents } from "./domain";
import type { State } from "./types";

export type Alert = { id: string; level: "alta" | "media" | "info"; title: string; body: string; href: string };

/** Avisos dentro de la app, calculados en vivo con los datos reales (no se guardan). */
export function deriveAlerts(s: State, today: string): Alert[] {
  const out: Alert[] = [];
  const days = s.prefs.reminderDays;
  for (const u of upcomingEvents(s.events, today, Math.max(...days, 15))) {
    const hit = u.e.reminders.filter((d) => days.includes(d)).sort((a, b) => a - b).find((d) => u.in <= d);
    if (hit !== undefined && (u.e.relevance === "alta" || u.e.relevance === "media" || u.e.source === "manual")) {
      const ideas = s.ideas.filter((i) => i.eventId === u.e.id && i.status !== "descartada").length;
      out.push({ id: `e${u.e.id}${u.date}`, level: u.in <= 3 ? "media" : "info", title: u.in === 0 ? `Hoy: ${u.e.title}` : `${u.e.title} en ${u.in} ${u.in === 1 ? "día" : "días"}`, body: ideas ? `Hay ${ideas} idea(s) de video para esta fecha.` : "Pide ideas de video para esta fecha.", href: "/calendario" });
    }
  }
  for (const t of s.tasks) {
    if (isOverdue(t, today)) out.push({ id: "o" + t.id, level: "alta", title: "Entrega atrasada", body: `${t.title} · era para ${fmtDate(t.due)}`, href: "/videos" });
    else if (t.due && !["revision", "aprobado", "publicado"].includes(t.status) && daysBetween(today, t.due) <= 3 && daysBetween(today, t.due) >= 0) out.push({ id: "d" + t.id, level: "media", title: `Entrega en ${daysBetween(today, t.due)} día(s)`, body: t.title, href: "/videos" });
    const pend = t.notes.filter((n) => !n.resolved).length;
    if (pend && t.changes) out.push({ id: "f" + t.id, level: "alta", title: `${pend} corrección(es) por hacer`, body: t.title, href: "/videos" });
    if (t.status === "revision") out.push({ id: "r" + t.id, level: "info", title: "Esperando feedback", body: t.title, href: "/videos" });
    if (t.status === "aprobado") out.push({ id: "a" + t.id, level: "info", title: "Aprobado: listo para publicar", body: t.title, href: "/videos" });
  }
  return out;
}
