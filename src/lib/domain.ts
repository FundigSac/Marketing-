import { addDays, daysBetween } from "./utils";
import type { EventItem, Metric, State, Task, TaskStatus } from "./types";

/* ---------- Eventos recurrentes (se calculan, no se guardan por año) ---------- */

/** Todas las fechas (YYYY-MM-DD) en que ocurre el evento dentro de [from, to]. */
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
  const horizon = addDays(today, 366 * 3);
  const o = occurrences(e, today, horizon);
  return o[0] ?? null;
}

export function upcomingEvents(events: EventItem[], today: string, days = 60) {
  const to = addDays(today, days);
  return events
    .filter((e) => e.relevance !== "descartada")
    .flatMap((e) => occurrences(e, today, to).slice(0, 1).map((date) => ({ e, date, in: daysBetween(today, date) })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Tareas ---------- */

// Criterio de avance (documentado en pantalla): cada estado vale un porcentaje fijo del recorrido de producción.
export const STATUS_WEIGHT: Record<TaskStatus, number> = {
  pendiente: 0, produccion: 25, entregado: 50, revision: 60, cambios: 40, aprobado: 80, programado: 90, publicado: 100, analizado: 100,
};
export const taskProgress = (t: Task) => {
  const base = STATUS_WEIGHT[t.status];
  if (!t.checklist.length || base >= 100) return base;
  const done = t.checklist.filter((c) => c.done).length / t.checklist.length;
  return Math.round(base * 0.7 + done * 30 * (base ? 1 : 0.5));
};
export const isOverdue = (t: Task, today: string) => !!t.due && t.due.slice(0, 10) < today && !["publicado", "analizado", "aprobado", "programado"].includes(t.status);
export const avgProgress = (ts: Task[]) => (ts.length ? Math.round(ts.reduce((a, t) => a + taskProgress(t), 0) / ts.length) : 0);

/* ---------- Métricas ---------- */

export type Totals = { spend: number; reach: number; views: number; interactions: number; clicks: number; messages: number; quotes: number; sales: number; salesAmount: number };
export const emptyTotals = (): Totals => ({ spend: 0, reach: 0, views: 0, interactions: 0, clicks: 0, messages: 0, quotes: 0, sales: 0, salesAmount: 0 });
export function totals(ms: Metric[]): Totals {
  const t = emptyTotals();
  for (const m of ms) for (const k of Object.keys(t) as (keyof Totals)[]) t[k] += m[k] || 0;
  return t;
}
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function byProduct(s: State, ms: Metric[]) {
  const map = new Map<string, Metric[]>();
  for (const m of ms) { const k = m.productId ?? "—"; map.set(k, [...(map.get(k) ?? []), m]); }
  return [...map.entries()].map(([id, list]) => ({ id, name: s.products.find((p) => p.id === id)?.name ?? "Sin producto", t: totals(list) }))
    .sort((a, b) => b.t.quotes - a.t.quotes || b.t.messages - a.t.messages);
}

/* ---------- Simulador (supuestos explícitos) ---------- */

export type Scenario = { name: string; cpm: number; ctr: number; msgRate: number; quoteRate: number; closeRate: number; ticket: number };
export function project(budget: number, sc: Scenario) {
  const impressions = (budget / sc.cpm) * 1000;
  const clicks = impressions * sc.ctr;
  const messages = clicks * sc.msgRate;
  const quotes = messages * sc.quoteRate;
  const sales = quotes * sc.closeRate;
  return { impressions, clicks, messages, quotes, sales, revenue: sales * sc.ticket };
}
