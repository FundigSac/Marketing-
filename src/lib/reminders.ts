import { addDays, daysBetween } from "./utils";
import { occurrences } from "./domain";
import type { DeliveryLog, State } from "./types";

export type DueNotice = {
  key: string; subject: string; heading: string; lines: string[]; link: string; days?: number;
  eventId?: string; eventTitle?: string; eventNote?: string;
};

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const limaToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now);
export const limaHour = (now = new Date()) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hour12: false }).format(now)) % 24;

export function inQuietHours(quiet: { start: string; end: string }, hour: number) {
  const s = Number(quiet.start.slice(0, 2)), e = Number(quiet.end.slice(0, 2));
  return s === e ? false : s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

/** Avisos que corresponden hoy (America/Lima). Función pura: no envía nada. */
export function computeDue(s: State, today: string): DueNotice[] {
  const out: DueNotice[] = [];
  const days = s.prefs.reminderDays;
  for (const e of s.events) {
    if (e.relevance === "descartada" || e.category === "publicacion") continue;
    if (e.source === "sugerida" && e.relevance === "baja") continue;
    for (const d of e.reminders.filter((x) => days.includes(x))) {
      const target = addDays(today, d);
      if (!occurrences(e, target, target).length) continue;
      const n = s.ideas.filter((i) => i.eventId === e.id && i.status !== "descartada").length;
      out.push({
        key: `ev:${e.id}:${target}:${d}`, days: d, eventId: e.id, eventTitle: e.title, eventNote: e.relevanceNote, link: `${APP_URL()}/ideas`,
        subject: "FUNDIGSAC | Se aproxima una fecha importante",
        heading: d === 0 ? `Hoy es ${e.title}.` : `Se acerca una fecha importante para FUNDIGSAC: ${e.title} (en ${d} ${d === 1 ? "día" : "días"}).`,
        lines: [n > 0 ? `La IA preparó ${n} ${n === 1 ? "idea" : "ideas"} de videos.` : "Entra al dashboard para pedir ideas de videos para esta fecha.", "Entra al dashboard para escoger una y comenzar su producción."],
      });
    }
  }
  for (const t of s.tasks) {
    if (!t.due || ["revision", "aprobado", "publicado"].includes(t.status)) continue;
    const left = daysBetween(today, t.due);
    if (left < 0) out.push({ key: `task-late:${t.id}:${today}`, subject: "FUNDIGSAC | Entrega atrasada", heading: `La entrega “${t.title}” venció el ${t.due.slice(0, 10)}.`, lines: ["Entra al dashboard para enviar tu avance."], link: `${APP_URL()}/videos?tarea=${t.id}` });
    else if (days.includes(left)) out.push({ key: `task:${t.id}:${left}`, days: left, subject: "FUNDIGSAC | Se acerca una entrega", heading: left === 0 ? `Hoy vence: ${t.title}.` : `En ${left} ${left === 1 ? "día" : "días"} vence: ${t.title}.`, lines: ["Sube tu avance desde el dashboard cuando esté listo."], link: `${APP_URL()}/videos?tarea=${t.id}` });
  }
  return out;
}

/** Quita los ya enviados; reintenta (máx. 3 intentos) los que fallaron. */
export function pending(due: DueNotice[], log: DeliveryLog[]) {
  const sent = new Set(log.filter((l) => l.status === "enviado" || (l.status === "error" && l.attempts >= 3)).map((l) => l.key));
  return due.filter((d) => !sent.has(d.key));
}

export function emailHtml(n: Pick<DueNotice, "heading" | "lines" | "link">, name = "Fabrizio") {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <div style="background:#131415;padding:16px 20px;border-radius:12px 12px 0 0"><img src="${APP_URL()}/logo.png" alt="FUNDIGSAC" height="38" style="height:38px;display:block"/></div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <p>Hola, ${esc(name)}.</p><p><b>${esc(n.heading)}</b></p>${n.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
    <p><a href="${n.link}" style="display:inline-block;background:#f26b1d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Abrir el dashboard</a></p>
    <p style="color:#64748b;font-size:12px">Puedes cambiar los recordatorios en Ajustes del dashboard.</p>
  </div></div>`;
}
