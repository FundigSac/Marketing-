"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { update, useMe } from "@/lib/store";
import { can, EVENT_CATEGORIES, CONTENT_TYPES, type EventCategory, type EventItem } from "@/lib/types";
import { todayLima, uid } from "@/lib/utils";

const REMINDER_DAYS = [30, 14, 7, 3, 1, 0];
const schema = z.object({
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 letras)."),
  start: z.string().min(10, "Elige la fecha de inicio."),
  end: z.string().optional(),
}).refine((v) => !v.end || v.end >= v.start.slice(0, 10), { message: "La fecha final no puede ser anterior al inicio.", path: ["end"] });

export function EventForm({ id }: { id?: string }) {
  const router = useRouter();
  const { s, me } = useMe();
  const existing = id ? s.events.find((e) => e.id === id) : undefined;
  const [f, setF] = useState(() => ({
    title: existing?.title ?? "", description: existing?.description ?? "", category: (existing?.category ?? "marketing") as EventCategory,
    start: existing?.start.slice(0, 10) ?? todayLima(), time: existing && !existing.allDay ? existing.start.slice(11, 16) : "", end: existing?.end?.slice(0, 10) ?? "",
    repeat: existing?.repeat ?? "none", interval: existing?.repeatInterval ?? 1, until: existing?.repeatUntil ?? "",
    ownerId: existing?.ownerId ?? "", campaignId: existing?.campaignId ?? "", contentType: existing?.contentType ?? "",
    reminders: existing?.reminders ?? [7, 1], relevance: existing?.relevance ?? "media", relevanceNote: existing?.relevanceNote ?? "",
  }));
  const [errs, setErrs] = useState<Record<string, string>>({});
  if (!me) return null;
  if (!can(me.role, "events.write")) return <Card className="p-6 text-sm text-muted-foreground">Tu rol ({me.role}) no puede crear ni editar eventos.</Card>;
  if (id && !existing) return <Card className="p-6 text-sm">No se encontró el evento.</Card>;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (d: number) => set("reminders", f.reminders.includes(d) ? f.reminders.filter((x) => x !== d) : [...f.reminders, d].sort((a, b) => b - a));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ title: f.title, start: f.start, end: f.end || undefined });
    if (!r.success) { setErrs(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setErrs({});
    const base: Omit<EventItem, "id" | "taskIds" | "ideaIds"> = {
      title: f.title.trim(), description: f.description || undefined, category: f.category,
      start: f.time ? `${f.start}T${f.time}` : f.start, end: f.end || undefined, allDay: !f.time,
      repeat: f.repeat as EventItem["repeat"], repeatInterval: f.repeat === "custom" ? Math.max(1, f.interval) : undefined, repeatUntil: f.until || undefined,
      ownerId: f.ownerId || undefined, campaignId: f.campaignId || undefined, contentType: f.contentType || undefined,
      reminders: f.reminders, relevance: f.relevance as EventItem["relevance"], relevanceNote: f.relevanceNote || undefined,
      source: existing?.source ?? "manual",
    };
    const nid = existing?.id ?? uid();
    update((st) => {
      if (existing) Object.assign(st.events.find((x) => x.id === existing.id)!, base);
      else st.events.push({ ...base, id: nid, taskIds: [], ideaIds: [] });
    }, `${existing ? "Editó" : "Creó"} el evento "${base.title}"`);
    toast.success(existing ? "Evento actualizado" : "Evento creado");
    router.push(`/eventos/${nid}`);
  };

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-3">
      <Card className="space-y-4 p-5 lg:col-span-2">
        <Field label="Título" error={errs.title}><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej. Día Mundial del Agua" /></Field>
        <Field label="Descripción"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Inicio" error={errs.start}><Input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
          <Field label="Hora (opcional)"><Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></Field>
          <Field label="Fin (varios días)" error={errs.end}><Input type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Repetición"><Select value={f.repeat} onChange={(e) => set("repeat", e.target.value as typeof f.repeat)}><option value="none">No se repite</option><option value="yearly">Cada año</option><option value="monthly">Cada mes</option><option value="weekly">Cada semana</option><option value="custom">Cada N días</option></Select></Field>
          {f.repeat === "custom" && <Field label="Cada cuántos días"><Input type="number" min={1} value={f.interval} onChange={(e) => set("interval", Number(e.target.value))} /></Field>}
          {f.repeat !== "none" && <Field label="Repetir hasta (opcional)"><Input type="date" value={f.until} onChange={(e) => set("until", e.target.value)} /></Field>}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recordatorios (días antes)</p>
          <div className="flex flex-wrap gap-2">{REMINDER_DAYS.map((d) => <button type="button" key={d} onClick={() => toggleDay(d)} aria-pressed={f.reminders.includes(d)} className={`rounded-full border px-3 py-1 text-sm transition ${f.reminders.includes(d) ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{d === 0 ? "El mismo día" : `${d} días`}</button>)}</div>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <Field label="Tipo"><Select value={f.category} onChange={(e) => set("category", e.target.value as EventCategory)}>{Object.entries(EVENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Responsable"><Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Campaña"><Select value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}><option value="">Ninguna</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Tipo de contenido"><Select value={f.contentType} onChange={(e) => set("contentType", e.target.value)}><option value="">—</option>{CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Relevancia para FUNDIGSAC"><Select value={f.relevance} onChange={(e) => set("relevance", e.target.value as typeof f.relevance)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option><option value="descartada">Descartada</option></Select></Field>
        <Field label="Por qué es relevante"><Textarea value={f.relevanceNote} onChange={(e) => set("relevanceNote", e.target.value)} /></Field>
        <div className="flex gap-2"><Button type="submit" variant="brand" className="flex-1">{existing ? "Guardar cambios" : "Crear evento"}</Button><Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button></div>
      </Card>
    </form>
  );
}
