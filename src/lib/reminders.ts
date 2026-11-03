import { addDays, daysBetween } from "./utils";
import { occurrences } from "./domain";
import type { DeliveryLog, EventCategory, State } from "./types";
import { EVENT_CATEGORIES } from "./types";

export type DueNotice = {
  key: string; // clave única: evita duplicados entre ejecuciones
  category: EventCategory | "digest";
  subject: string; heading: string; lines: string[]; link: string; days?: number;
};

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export function limaToday(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now); }
export function limaHour(now = new Date()) { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hour12: false }).format(now)) % 24; }

export function inQuietHours(quiet: { start: string; end: string }, hour: number) {
  const s = Number(quiet.start.slice(0, 2)), e = Number(quiet.end.slice(0, 2));
  return s === e ? false : s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

/** Calcula qué avisos corresponden hoy (America/Lima). Función pura: no envía nada. */
export function computeDue(s: State, today: string, hour: number): DueNotice[] {
  const out: DueNotice[] = [];
  const firstIdeas = s.ideas.filter((i) => i.status === "propuesta").length;
  const who = (id?: string) => s.users.find((u) => u.id === id)?.name ?? "equipo";

  for (const e of s.events) {
    if (e.relevance === "descartada") continue;
    const cfg = s.prefs.categories[e.category];
    if (!cfg?.enabled) continue;
    const days = e.reminders.filter((d) => cfg.days.includes(d));
    for (const d of days) {
      const target = addDays(today, d);
      if (!occurrences(e, target, target).length) continue;
      out.push({
        key: `ev:${e.id}:${target}:${d}`, category: e.category, days: d, link: `${APP_URL()}/eventos/${e.id}`,
        subject: d === 0 ? `FUNDIGSAC | Hoy: ${e.title}` : "FUNDIGSAC | Se aproxima una fecha importante",
        heading: d === 0 ? `Hoy es ${e.title}.` : `Dentro de ${d} ${d === 1 ? "día" : "días"} tenemos una fecha importante para nuestro calendario de marketing: ${e.title}.`,
        lines: [
          `Tipo: ${EVENT_CATEGORIES[e.category].label}.${e.relevanceNote ? ` ${e.relevanceNote}` : ""}`,
          e.ideaIds.length || firstIdeas ? "Hay ideas de contenido para revisar." : "Ingresa para pedir ideas de contenido para esta fecha.",
          "Ingresa al dashboard para revisarlas, escoger la mejor propuesta y programar su preparación.",
          `Fecha límite para presentar un primer avance: ${addDays(today, Math.min(Math.max(d - 2, 1), 5))}.`,
        ],
      });
    }
  }

  const delCfg = s.prefs.categories.entrega;
  if (delCfg?.enabled) {
    for (const d of s.deliverables) {
      if (d.receivedAt) continue;
      const left = daysBetween(today, d.dueAt);
      if (left < 0) {
        out.push({ key: `del-late:${d.id}:${today}`, category: "entrega", link: `${APP_URL()}/produccion/entregables`, subject: "FUNDIGSAC | Entregable vencido", heading: `El entregable “${d.title}” venció el ${d.dueAt.slice(0, 10)} y no se recibió.`, lines: [`Responsable: ${who(d.assigneeId)}.`, "Ingresa al dashboard para ver el estado."] });
      } else if (delCfg.days.includes(left)) {
        out.push({ key: `del:${d.id}:${left}`, category: "entrega", days: left, link: `${APP_URL()}/produccion/entregables`, subject: "FUNDIGSAC | Se acerca una entrega", heading: left === 0 ? `Hoy vence: ${d.title}.` : `En ${left} ${left === 1 ? "día" : "días"} vence: ${d.title}.`, lines: [`Responsable: ${who(d.assigneeId)}.`, "Sube el archivo desde el dashboard cuando esté listo."] });
      }
    }
    for (const t of s.tasks) {
      if (!t.due || t.due.slice(0, 10) >= today || ["aprobado", "programado", "publicado", "analizado"].includes(t.status)) continue;
      out.push({ key: `task-late:${t.id}:${today}`, category: "entrega", link: `${APP_URL()}/produccion/tareas/${t.id}`, subject: "FUNDIGSAC | Tarea atrasada", heading: `La tarea “${t.title}” está atrasada (venció el ${t.due.slice(0, 10)}).`, lines: [`Responsable: ${who(t.assigneeId)}.`] });
    }
  }

  if (s.prefs.digest && hour >= s.prefs.digestHour) {
    const late = s.tasks.filter((t) => t.due && t.due.slice(0, 10) < today && !["aprobado", "programado", "publicado", "analizado"].includes(t.status)).length;
    const soon = s.events.filter((e) => e.relevance !== "descartada" && occurrences(e, today, addDays(today, 7)).length).length;
    out.push({ key: `digest:${today}`, category: "digest", link: APP_URL(), subject: "FUNDIGSAC | Resumen diario", heading: "Resumen del día", lines: [`Fechas en los próximos 7 días: ${soon}.`, `Tareas atrasadas: ${late}.`, `Videos por revisar: ${s.videos.filter((v) => v.status !== "aprobado").length}.`, `Ideas por decidir: ${firstIdeas}.`] });
  }
  return out;
}

/** Quita los avisos ya enviados; reintenta (máx. 3 intentos) los que fallaron. */
export function pending(due: DueNotice[], log: DeliveryLog[]) {
  const sent = new Set(log.filter((l) => l.status === "enviado" || (l.status === "error" && l.attempts >= 3)).map((l) => l.key));
  return due.filter((d) => !sent.has(d.key));
}

export function emailHtml(n: DueNotice, name = "equipo") {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <div style="background:#194391;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:600">FUNDIGSAC · Marketing OS</div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <p>Hola, ${esc(name)}:</p><p><b>${esc(n.heading)}</b></p>${n.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
    <p><a href="${n.link}" style="display:inline-block;background:#f26b1d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Abrir el dashboard</a></p>
    <p style="color:#64748b;font-size:12px">Puedes silenciar categorías o cambiar horarios en Configuración de avisos.</p>
  </div></div>`;
}
