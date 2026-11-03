import { describe, expect, it } from "vitest";
import { compliance, nextOccurrence, occurrences, periodProgress, taskProgress, weekRange } from "../src/lib/domain";
import { computeDue, inQuietHours, pending } from "../src/lib/reminders";
import { toIdea } from "../src/lib/context";
import { seedState } from "../src/lib/seed";
import type { EventItem, Task } from "../src/lib/types";

const ev = (p: Partial<EventItem>): EventItem => ({ id: "e1", title: "Día Mundial del Agua", category: "industria", start: "2026-03-22", allDay: true, repeat: "yearly", reminders: [15, 7, 3, 1], relevance: "alta", source: "manual", ...p });
const task = (p: Partial<Task>): Task => ({ id: "t", title: "Video", status: "todo", priority: "media", checklist: [], comments: [], files: [], notes: [], history: [], createdAt: "", ...p });

describe("calendario dinámico", () => {
  it("un evento anual aparece en cualquier año futuro sin duplicar filas", () => {
    expect(occurrences(ev({}), "2045-03-01", "2045-03-31")).toEqual(["2045-03-22"]);
    expect(occurrences(ev({}), "2020-03-01", "2020-03-31")).toEqual([]);
    expect(nextOccurrence(ev({}), "2026-11-03")).toBe("2027-03-22");
  });
  it("mensual, semanal, cada N días y varios días", () => {
    expect(occurrences(ev({ repeat: "monthly", start: "2026-01-31" }), "2026-02-01", "2026-03-31")).toEqual(["2026-02-28", "2026-03-31"]);
    expect(occurrences(ev({ repeat: "weekly", start: "2026-11-02" }), "2026-11-01", "2026-11-20")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(occurrences(ev({ repeat: "custom", repeatInterval: 10, start: "2026-01-01", repeatUntil: "2026-01-25" }), "2026-01-01", "2026-12-31")).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"]);
    expect(occurrences(ev({ repeat: "none", start: "2026-05-10", end: "2026-05-12" }), "2026-05-11", "2026-05-11")).toEqual(["2026-05-11"]);
  });
});

describe("progreso real", () => {
  it("avance de tarjeta sale del estado y de los pasos", () => {
    expect(taskProgress(task({ status: "todo" }))).toBe(0);
    expect(taskProgress(task({ status: "publicado" }))).toBe(100);
    expect(taskProgress(task({ status: "edicion", checklist: [{ id: "1", text: "a", done: true }, { id: "2", text: "b", done: false }] }))).toBe(Math.round(40 * 0.75 + 0.5 * 25));
  });
  it("avance semanal cuenta solo aprobados o publicados con entrega en el periodo", () => {
    const w = weekRange("2026-11-04"); // miércoles
    expect(w).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    const p = periodProgress([task({ due: "2026-11-03", status: "publicado" }), task({ due: "2026-11-05", status: "edicion" }), task({ due: "2026-12-01", status: "publicado" })], w.from, w.to);
    expect(p).toEqual({ total: 2, done: 1, pct: 50 });
  });
  it("cumplimiento de entregas", () => {
    const c = compliance([task({ due: "2026-11-05", deliveredAt: "2026-11-04T10:00:00Z" }), task({ due: "2026-11-05", deliveredAt: "2026-11-07T10:00:00Z" }), task({ due: "2026-11-05" })]);
    expect(c).toEqual({ delivered: 2, onTime: 1, pct: 50 });
  });
});

describe("recordatorios por correo", () => {
  it("avisa 15, 7, 3 y 1 día antes y cuenta las ideas preparadas", () => {
    const s = seedState(); s.events = [ev({})];
    expect(computeDue(s, "2027-03-07").map((d) => d.days)).toEqual([15]);
    expect(computeDue(s, "2027-03-15").map((d) => d.days)).toEqual([7]);
    expect(computeDue(s, "2027-03-20").map((d) => d.days)).toEqual([2].filter(() => false)); // 2 días no está configurado
    const due = computeDue(s, "2027-03-19")[0];
    expect(due.subject).toBe("FUNDIGSAC | Se aproxima una fecha importante");
    expect(due.lines[0]).toMatch(/pedir ideas/);
    s.ideas = [toIdea(s, { title: "a", concept: "c", script: "s", productName: "Codo HDPE", duration: "30 s", platform: "TikTok", why: "w", date: "" }, "ia", "e1", "2027-03-19")];
    expect(computeDue(s, "2027-03-19")[0].lines[0]).toBe("La IA preparó 1 idea de videos.");
  });
  it("respeta la configuración de días y no duplica envíos", () => {
    const s = seedState(); s.events = [ev({})]; s.prefs.reminderDays = [7];
    expect(computeDue(s, "2027-03-07")).toHaveLength(0);
    const due = computeDue(s, "2027-03-15");
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "enviado", attempts: 1 }])).toHaveLength(0);
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "error", attempts: 1 }])).toHaveLength(1);
    expect(pending(due, [{ key: due[0].key, at: "", channel: "email", to: "x", status: "error", attempts: 3 }])).toHaveLength(0);
  });
  it("no avisa fechas descartadas y avisa entregas próximas y atrasadas", () => {
    const s = seedState(); s.events = [ev({ relevance: "descartada" })];
    s.tasks = [task({ id: "a", due: "2027-03-18", status: "edicion" }), task({ id: "b", due: "2027-03-10", status: "todo" }), task({ id: "c", due: "2027-03-18", status: "revision" })];
    const keys = computeDue(s, "2027-03-15").map((d) => d.key);
    expect(keys.some((k) => k.startsWith("ev:"))).toBe(false);
    expect(keys).toContain("task-late:b:2027-03-15");
    expect(keys.some((k) => k.startsWith("task:c"))).toBe(false); // ya está en revisión
  });
  it("horario de silencio cruza la medianoche", () => {
    expect(inQuietHours({ start: "21:00", end: "07:00" }, 23)).toBe(true);
    expect(inQuietHours({ start: "21:00", end: "07:00" }, 12)).toBe(false);
  });
});

import { migrateV2, toV3 } from "../src/lib/migrate";

describe("migración desde el sistema anterior (v2)", () => {
  const old = {
    version: 2,
    users: [{ id: "u1", name: "Administrador", email: "", role: "admin", active: true }, { id: "u2", name: "Fabrizio", email: "f@x.pe", role: "marketing", active: true }, { id: "u3", name: "Karla", email: "", role: "ventas", active: true }],
    events: [{ id: "e1", title: "Navidad", category: "peru", start: "2026-12-25", allDay: true, repeat: "yearly", reminders: [7, 1], relevance: "media", source: "sugerida", taskIds: [], ideaIds: [] }, { id: "e2", title: "Grabación", category: "grabacion", start: "2026-11-10", allDay: true, reminders: [1], relevance: "alta", source: "manual", taskIds: [], ideaIds: [] }],
    ideas: [{ id: "i1", title: "Video HDPE", visual: "Primeros planos", script: "Guion", network: "TikTok", why: "Confianza", priority: "alta", status: "elegida", source: "ia", createdAt: "2026-11-01T00:00:00Z", versions: [{ v: 1, at: "2026-11-01T00:00:00Z", note: "v1", body: { script: "Guion", visual: "Primeros planos" } }], messages: [], decisions: [] }],
    tasks: [
      { id: "t1", title: "Video A", status: "cambios", priority: "alta", assigneeId: "u2", due: "2026-11-05", checklist: [], comments: [], attachments: [{ id: "f9", name: "ficha.pdf" }], history: [{ at: "2026-11-02T10:00:00Z", byId: "u2", to: "entregado" }], createdAt: "2026-11-01T00:00:00Z" },
      { id: "t2", title: "Video B", status: "publicado", priority: "media", due: "2026-11-03", checklist: [], comments: [], attachments: [], history: [{ at: "2026-11-02T10:00:00Z", byId: "u2", from: "aprobado", to: "publicado" }], createdAt: "2026-11-01T00:00:00Z" },
    ],
    videos: [{ id: "v1", taskId: "t1", versions: [{ v: 1, fileId: "f1", at: "2026-11-02T09:00:00Z" }], notes: [{ id: "n1", at: 1.2, text: "Más real", mandatory: true, resolved: false, byId: "u1", version: 1, createdAt: "2026-11-02T11:00:00Z" }] }],
    products: [{ id: "p1", name: "Codo HDPE", specs: "", pitch: "Argumento" }],
    campaigns: [{ id: "c1", name: "Prueba", budget: 300 }], metrics: [{ id: "m1", campaignId: "c1", spend: 20 }], leads: [{ id: "l1" }], deliverables: [{ id: "d1" }],
    prefs: { email: true, push: false, recipients: ["a@b.pe"], ideasPerDay: 3, quiet: { start: "21:00", end: "07:00" }, pushSubs: [] }, ai: { calls: {} }, log: [], deliveryLog: [], currentUserId: "u1",
  };
  it("convierte estados, roles y conserva archivos y feedback", () => {
    const s = migrateV2(old);
    expect(s.version).toBe(3);
    expect(s.users.map((u) => [u.name, u.role])).toEqual([["Administrador", "reviewer"], ["Fabrizio", "creator"]]);
    expect(s.tasks[0]).toMatchObject({ status: "edicion", changes: true });
    expect(s.tasks[0].files.map((f) => f.id)).toEqual(["f1", "f9"]);
    expect(s.tasks[0].notes[0]).toMatchObject({ fileId: "f1", at: 1.2, resolved: false });
    expect(s.tasks[0].deliveredAt).toBe("2026-11-02T10:00:00Z");
    expect(s.tasks[1].status).toBe("publicado");
    expect(s.ideas[0]).toMatchObject({ status: "elegida", platform: "TikTok", concept: "Primeros planos" });
    expect(s.events[1].category).toBe("personal");
    expect(s.products[0]).toMatchObject({ name: "Codo HDPE", notes: "Argumento" });
    expect(s.currentUserId).toBe("u2");
  });
  it("no pierde campañas, métricas ni consultas: quedan en legacy", () => {
    const s = migrateV2(old);
    expect(s.legacy).toMatchObject({ campaigns: [{ id: "c1" }], metrics: [{ id: "m1" }], leads: [{ id: "l1" }], deliverables: [{ id: "d1" }] });
  });
  it("toV3 acepta v3 y datos vacíos", () => {
    expect(toV3(migrateV2(old)).version).toBe(3);
    expect(toV3(null).version).toBe(3);
  });
});
