import { addDays, daysBetween } from "./utils";
import { COLUMNS, type Column, type EventItem, type Task } from "./types";

/* ---------- Eventos recurrentes (se calculan, no se guardan por año) ---------- */

/** Fechas (YYYY-MM-DD) en que ocurre el evento dentro de [from, to]. */
export function occurrences(e: EventItem, from: string, to: string): string[] {
  const start = e.start.slice(0, 10);
  const until = e.repeatUntil && e.repeatUntil < to ? e.repeatUntil : to;
  const rep = e.repeat ?? "none";
  const out: string[] = [];
  if (rep === "none") {
    const end = (e.end ?? e.start).slice(0, 10);
    if (start <= to && end >= from) out.push(start < from ? from : start);
    return out;
  }
  const interval = Math.max(1, e.repeatInterval ?? 1);
  const [sy, sm, sd] = start.split("-").map(Number);
  if (rep === "yearly") {
    for (let y = Math.max(sy, Number(from.slice(0, 4))); y <= Number(until.slice(0, 4)); y++) {
      if ((y - sy) % interval) continue;
      const d = `${y}-${String(sm).padStart(2, "0")}-${String(sd).padStart(2, "0")}`;
      if (d >= start && d >= from && d <= until) out.push(d);
    }
  } else if (rep === "monthly") {
    let y = sy, m = sm - 1, n = 0;
    while (n < 2400) {
      const d = `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(sd, new Date(y, m + 1, 0).getDate())).padStart(2, "0")}`;
      if (d > until) break;
      if (n % interval === 0 && d >= from) out.push(d);
      m++; if (m > 11) { m = 0; y++; } n++;
    }
  } else {
    const step = (rep === "weekly" ? 7 : 1) * interval;
    let d = start;
    while (d < from) d = addDays(d, step);
    for (let i = 0; d <= until && i < 5000; i++, d = addDays(d, step)) out.push(d);
  }
  return out;
}

export function nextOccurrence(e: EventItem, today: string): string | null {
  return occurrences(e, today, addDays(today, 366 * 3))[0] ?? null;
}

export function upcomingEvents(events: EventItem[], today: string, days = 60) {
  const to = addDays(today, days);
  return events
    .filter((e) => e.relevance !== "descartada")
    .flatMap((e) => occurrences(e, today, to).slice(0, 1).map((date) => ({ e, date, in: daysBetween(today, date) })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Producción ---------- */

const weight = (c: Column) => COLUMNS.find((x) => x.id === c)!.weight;
/** Avance de una tarjeta: el estado aporta la mayor parte y los pasos completados ajustan el resto. */
export function taskProgress(t: Task) {
  const base = t.changes ? 50 : weight(t.status);
  if (!t.checklist.length || base >= 100) return base;
  const done = t.checklist.filter((c) => c.done).length / t.checklist.length;
  return Math.min(99, Math.round(base * 0.75 + done * 25 * (base ? 1 : 0.4)));
}
export const isDone = (t: Task) => t.status === "aprobado" || t.status === "publicado";
export const isOpen = (t: Task) => t.status !== "publicado";
export const isOverdue = (t: Task, today: string) => !!t.due && t.due.slice(0, 10) < today && !isDone(t);

/** Avance real de un periodo: tareas con entrega en el periodo que ya están aprobadas o publicadas. */
export function periodProgress(tasks: Task[], from: string, to: string) {
  const inRange = tasks.filter((t) => t.due && t.due.slice(0, 10) >= from && t.due.slice(0, 10) <= to);
  const done = inRange.filter(isDone).length;
  return { total: inRange.length, done, pct: inRange.length ? Math.round((done / inRange.length) * 100) : 0 };
}

export function weekRange(today: string) {
  const dow = (new Date(today + "T00:00:00").getDay() + 6) % 7; // lunes = 0
  const from = addDays(today, -dow);
  return { from, to: addDays(from, 6) };
}
export const monthRange = (today: string) => {
  const [y, m] = today.split("-").map(Number);
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` };
};

/** Cumplimiento: de las tareas entregadas a revisión con fecha límite, cuántas llegaron a tiempo. */
export function compliance(tasks: Task[]) {
  const delivered = tasks.filter((t) => t.deliveredAt && t.due);
  const onTime = delivered.filter((t) => t.deliveredAt!.slice(0, 10) <= t.due!.slice(0, 10)).length;
  return { delivered: delivered.length, onTime, pct: delivered.length ? Math.round((onTime / delivered.length) * 100) : null };
}
