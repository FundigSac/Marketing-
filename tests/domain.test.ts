import { describe, expect, it } from "vitest";
import { avgProgress, nextOccurrence, occurrences, project, taskProgress, totals } from "../src/lib/domain";
import { computeDue, inQuietHours, pending } from "../src/lib/reminders";
import { rowsToMetrics } from "../src/lib/metrics-io";
import { seedState } from "../src/lib/seed";
import { can } from "../src/lib/types";
import type { EventItem, Task } from "../src/lib/types";

const ev = (p: Partial<EventItem>): EventItem => ({ id: "e1", title: "Evento", category: "peru", start: "2026-03-22", allDay: true, repeat: "none", reminders: [7, 1], relevance: "alta", source: "manual", taskIds: [], ideaIds: [], ...p });
const task = (p: Partial<Task>): Task => ({ id: "t", title: "T", status: "pendiente", priority: "media", attachments: [], comments: [], history: [], checklist: [], createdAt: "", ...p });

describe("eventos recurrentes", () => {
  it("anual: aparece en cualquier año futuro sin duplicar filas", () => {
    expect(occurrences(ev({ repeat: "yearly" }), "2040-03-01", "2040-03-31")).toEqual(["2040-03-22"]);
    expect(occurrences(ev({ repeat: "yearly" }), "2026-01-01", "2026-02-28")).toEqual([]);
    expect(occurrences(ev({ repeat: "yearly" }), "2020-03-01", "2020-03-31")).toEqual([]); // antes del inicio
  });
  it("mensual y semanal", () => {
    expect(occurrences(ev({ repeat: "monthly", start: "2026-01-31" }), "2026-02-01", "2026-03-31")).toEqual(["2026-02-28", "2026-03-31"]);
    expect(occurrences(ev({ repeat: "weekly", start: "2026-11-02" }), "2026-11-01", "2026-11-20")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });
  it("cada N días respeta repetir hasta", () => {
    expect(occurrences(ev({ repeat: "custom", repeatInterval: 10, start: "2026-01-01", repeatUntil: "2026-01-25" }), "2026-01-01", "2026-12-31")).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"]);
  });
  it("varios días", () => {
    expect(occurrences(ev({ start: "2026-05-10", end: "2026-05-12" }), "2026-05-11", "2026-05-11")).toEqual(["2026-05-11"]);
  });
  it("próxima ocurrencia", () => {
    expect(nextOccurrence(ev({ repeat: "yearly", start: "2026-03-22" }), "2026-11-03")).toBe("2027-03-22");
  });
});

describe("progreso de tareas", () => {
  it("se calcula del estado y la lista de pasos", () => {
    expect(taskProgress(task({ status: "pendiente" }))).toBe(0);
    expect(taskProgress(task({ status: "publicado" }))).toBe(100);
    const half = task({ status: "produccion", checklist: [{ id: "1", text: "a", done: true }, { id: "2", text: "b", done: false }] });
    expect(taskProgress(half)).toBe(Math.round(25 * 0.7 + 0.5 * 30));
    expect(avgProgress([task({ status: "pendiente" }), task({ status: "publicado" })])).toBe(50);
  });
});

describe("recordatorios", () => {
  it("avisa a los 7 días y no duplica si ya se envió", () => {
    const s = seedState();
    s.events = [ev({ repeat: "yearly", start: "2026-03-22", reminders: [7, 1] })];
    const due = computeDue(s, "2030-03-15", 8);
    expect(due.map((d) => d.days)).toEqual([7]);
    expect(due[0].subject).toBe("FUNDIGSAC | Se aproxima una fecha importante");
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "enviado", attempts: 1 }])).toHaveLength(0);
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "error", attempts: 1 }])).toHaveLength(1); // reintento
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "error", attempts: 3 }])).toHaveLength(0); // tope
  });
  it("respeta categorías silenciadas y fechas descartadas", () => {
    const s = seedState();
    s.events = [ev({ repeat: "yearly", reminders: [7] }), ev({ id: "e2", repeat: "yearly", reminders: [7], relevance: "descartada" })];
    s.prefs.categories.peru.enabled = false;
    expect(computeDue(s, "2030-03-15", 8)).toHaveLength(0);
  });
  it("alerta de entregable vencido sin recibir", () => {
    const s = seedState(); s.events = [];
    s.deliverables = [{ id: "d1", title: "Borrador", kind: "borrador", dueAt: "2026-11-01", assigneeId: s.users[1].id }];
    expect(computeDue(s, "2026-11-03", 8).some((d) => d.key.startsWith("del-late:d1"))).toBe(true);
  });
  it("horario de silencio cruza la medianoche", () => {
    expect(inQuietHours({ start: "21:00", end: "07:00" }, 23)).toBe(true);
    expect(inQuietHours({ start: "21:00", end: "07:00" }, 3)).toBe(true);
    expect(inQuietHours({ start: "21:00", end: "07:00" }, 12)).toBe(false);
  });
});

describe("importación de métricas", () => {
  it("lee filas válidas y reporta errores sin inventar datos", () => {
    const s = seedState();
    const rows = [["fecha", "campana", "gasto", "mensajes"], ["2026-11-01", s.campaigns[0].name, "20,5", "4"], ["01/11/2026", "", "10", "2"], ["xx", "", "1", "1"], ["2026-11-02", "No existe", "1", "1"]];
    const { out, errors } = rowsToMetrics(rows, s, s.campaigns[0].id, "csv");
    expect(out).toHaveLength(2);
    expect(out[0].spend).toBe(20.5);
    expect(out[1].date).toBe("2026-11-01");
    expect(errors).toHaveLength(2);
    expect(totals(out).messages).toBe(6);
  });
});

describe("permisos y simulador", () => {
  it("solo el administrador revisa y aprueba", () => {
    expect(can("admin", "tasks.review")).toBe(true);
    expect(can("marketing", "tasks.review")).toBe(false);
    expect(can("visualizador", "events.write")).toBe(false);
    expect(can("ventas", "leads.write")).toBe(true);
  });
  it("proyección es proporcional al presupuesto", () => {
    const sc = { name: "x", cpm: 10, ctr: 0.01, msgRate: 0.05, quoteRate: 0.5, closeRate: 0.2, ticket: 100 };
    const a = project(100, sc), b = project(200, sc);
    expect(b.messages).toBeCloseTo(a.messages * 2);
    expect(a.revenue).toBeCloseTo(a.sales * 100);
  });
});
