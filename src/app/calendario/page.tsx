"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput } from "@fullcalendar/core";
import { toast } from "sonner";
import { Pencil, Plus, Sparkles, Trash2, Wand2, BellRing } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { generateIdeas } from "@/lib/actions";
import { IdeaActions } from "@/components/idea-actions";
import { deriveAlerts } from "@/lib/alerts";
import { callAI } from "@/lib/ai-client";
import { occurrences } from "@/lib/domain";
import { update, useMe } from "@/lib/store";
import { EVENT_CATEGORIES, REMINDER_OPTIONS, type EventCategory, type EventItem } from "@/lib/types";
import { addDays, fmtDate, todayLima, uid } from "@/lib/utils";

const empty = (date: string) => ({ id: "", title: "", description: "", category: "personal" as EventCategory, start: date, time: "", end: "", repeat: "none" as NonNullable<EventItem["repeat"]>, interval: 1, reminders: [7, 1], relevance: "media" as EventItem["relevance"], relevanceNote: "" });

function Calendario() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const q = useSearchParams();
  const ref = useRef<FullCalendar>(null);
  const today = todayLima();
  const [sel, setSel] = useState(today);
  const [form, setForm] = useState<ReturnType<typeof empty> | null>(q.get("nuevo") === "1" ? empty(today) : null);
  const [del, setDel] = useState<EventItem | null>(null);
  const [cats, setCats] = useState<Set<EventCategory>>(new Set(Object.keys(EVENT_CATEGORIES) as EventCategory[]));
  const [busy, setBusy] = useState("");
  const [focus, setFocus] = useState<string | null>(null);

  const source = useMemo(() => (info: { startStr: string; endStr: string }, ok: (e: EventInput[]) => void) => {
    const from = info.startStr.slice(0, 10), to = addDays(info.endStr.slice(0, 10), -1);
    const out: EventInput[] = [];
    for (const e of s.events) {
      if (e.relevance === "descartada" || !cats.has(e.category)) continue;
      const color = EVENT_CATEGORIES[e.category].color, rec = e.repeat && e.repeat !== "none";
      for (const date of occurrences(e, from, to)) {
        const timed = !e.allDay && e.start.length > 10;
        out.push({ id: `${e.id}|${date}`, title: e.title, backgroundColor: color, borderColor: color, editable: !rec, allDay: !timed, start: timed ? `${date}${e.start.slice(10)}` : date, end: !timed && !rec && e.end ? addDays(e.end.slice(0, 10), 1) : undefined, extendedProps: { kind: "event", eventId: e.id } });
      }
    }
    if (cats.has("entrega")) for (const t of s.tasks) if (t.due && t.due.slice(0, 10) >= from && t.due.slice(0, 10) <= to) out.push({ id: "t|" + t.id, title: "Entrega: " + t.title, start: t.due.slice(0, 10), allDay: true, backgroundColor: EVENT_CATEGORIES.entrega.color, borderColor: EVENT_CATEGORIES.entrega.color, editable: true, extendedProps: { kind: "task", taskId: t.id } });
    ok(out);
  }, [s.events, s.tasks, cats]);

  if (!ready || !me) return <PageSkeleton />;

  const dayEvents = s.events.filter((e) => e.relevance !== "descartada" && occurrences(e, sel, sel).length > 0);
  const dayTasks = s.tasks.filter((t) => t.due?.slice(0, 10) === sel);
  const dayIdeas = s.ideas.filter((i) => i.status !== "descartada" && (i.date === sel || dayEvents.some((e) => e.id === i.eventId)));
  const focusEv = focus ? s.events.find((e) => e.id === focus) : undefined;
  const soon = deriveAlerts(s, today).filter((a) => a.id.startsWith("e")).slice(0, 3);
  const dayEvent = dayEvents.find((e) => e.relevance !== "baja") ?? dayEvents[0];

  const openEdit = (e: EventItem) => setForm({ id: e.id, title: e.title, description: e.description ?? "", category: e.category, start: e.start.slice(0, 10), time: e.allDay ? "" : e.start.slice(11, 16), end: e.end?.slice(0, 10) ?? "", repeat: e.repeat ?? "none", interval: e.repeatInterval ?? 1, reminders: e.reminders, relevance: e.relevance, relevanceNote: e.relevanceNote ?? "" });
  const save = () => {
    if (!form || form.title.trim().length < 3) return;
    const base = { title: form.title.trim(), description: form.description || undefined, category: form.category, start: form.time ? `${form.start}T${form.time}` : form.start, end: form.end && form.end > form.start ? form.end : undefined, allDay: !form.time, repeat: form.repeat, repeatInterval: form.repeat === "custom" ? Math.max(1, form.interval) : undefined, reminders: form.reminders, relevance: form.relevance, relevanceNote: form.relevanceNote || undefined };
    update((st) => { if (form.id) Object.assign(st.events.find((x) => x.id === form.id)!, base); else st.events.push({ ...base, id: uid(), source: "manual" }); }, `${form.id ? "Editó" : "Creó"} el evento "${base.title}"`);
    toast.success(form.id ? "Evento actualizado" : "Evento creado"); setSel(form.start); setForm(null);
  };
  const ideas = async () => {
    setBusy("ideas");
    const r = await generateIdeas(s, { count: 3, eventId: dayEvent?.id, date: sel });
    setBusy("");
    r.ok ? toast.success(`${r.n} ideas para el ${fmtDate(sel)}${r.note ? ` · ${r.note}` : ""}`) : toast.error(r.error);
  };
  const evaluate = async () => {
    setBusy("eval");
    const items = s.events.filter((e) => e.relevance !== "descartada").map((e) => ({ title: e.title, date: occurrences(e, today, addDays(today, 120))[0] })).filter((x) => x.date);
    const r = await callAI<{ items: { title: string; relevance: EventItem["relevance"]; note: string }[] }>(s, "dates", { events: items });
    setBusy("");
    if (!r.ok) { toast.error(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada." : r.error); return; }
    update((st) => { for (const it of r.data.items) { const e = st.events.find((x) => x.title === it.title && x.source === "sugerida"); if (e) { e.relevance = it.relevance; e.relevanceNote = it.note; } } }, "La IA evaluó la relevancia de las fechas");
    toast.success("Relevancia actualizada. Puedes corregirla en cada evento.");
  };
  const toggleCat = (c: EventCategory) => setCats((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const f = form;

  return (
    <>
      <PageHeader title="Calendario" hint="Semana, mes o año, para cualquier año. Elige una fecha y mira qué video conviene hacer."
        actions={<><Button variant="outline" onClick={evaluate} disabled={busy === "eval"}><Wand2 />{busy === "eval" ? "Evaluando…" : "Evaluar fechas con IA"}</Button><Button variant="brand" onClick={() => setForm(empty(sel))}><Plus />Nuevo evento</Button></>} />
      {soon.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-sm"><BellRing className="size-4 shrink-0 text-brand" />{soon.map((a) => <span key={a.id} className="rounded-full bg-card px-2.5 py-0.5 text-xs shadow-[var(--shadow-sm)]"><b>{a.title}</b></span>)}</div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.entries(EVENT_CATEGORIES) as [EventCategory, { label: string; color: string }][]).map(([k, v]) => <button key={k} onClick={() => toggleCat(k)} aria-pressed={cats.has(k)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${cats.has(k) ? "border-transparent bg-card shadow-[var(--shadow-sm)]" : "border-dashed opacity-50"}`}><i className="size-2 rounded-full" style={{ background: v.color }} />{v.label}</button>)}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Ir a<Input type="date" className="h-8 w-auto" onChange={(e) => { if (e.target.value) { ref.current?.getApi().gotoDate(e.target.value); setSel(e.target.value); } }} /></label>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] sm:p-4">
            <FullCalendar ref={ref} plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]} locale={esLocale} firstDay={1} initialView="dayGridMonth" height="auto" nowIndicator dayMaxEvents={3} editable selectable multiMonthMaxColumns={3}
              headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth,multiMonthYear" }}
              buttonText={{ today: "Hoy", week: "Semana", month: "Mes", year: "Año" }} views={{ multiMonthYear: { buttonText: "Año" } }}
              events={source}
              dateClick={(i) => setSel(i.dateStr.slice(0, 10))}
              eventClick={(i) => { const p = i.event.extendedProps; if (p.kind === "task") router.push(`/videos?tarea=${p.taskId}`); else { const ev = s.events.find((x) => x.id === p.eventId); if (ev) { setSel(i.event.startStr.slice(0, 10)); setFocus(ev.id); } } }}
              eventDrop={(i) => {
                const p = i.event.extendedProps, start = i.event.startStr;
                if (p.kind === "task") update((st) => { const t = st.tasks.find((x) => x.id === p.taskId); if (t) t.due = start.slice(0, 10); }, `Movió la entrega de "${i.event.title}"`);
                else update((st) => { const e = st.events.find((x) => x.id === p.eventId); if (e) { e.start = start; e.end = i.event.endStr ? addDays(i.event.endStr.slice(0, 10), -1) : undefined; } }, `Movió el evento "${i.event.title}"`);
                toast.success("Fecha actualizada");
              }} />
          </div>
          <p className="text-xs text-muted-foreground">Arrastra eventos y entregas para moverlos. Las fechas repetidas (feriados, aniversarios) se editan desde su ficha para no desordenar toda la serie. Las fechas de Perú son sugeridas: verifícalas en El Peruano.</p>
        </div>

        <aside className="space-y-4">
          {focusEv && (
            <Card className="border-primary/40 p-5">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{EVENT_CATEGORIES[focusEv.category].label} · {fmtDate(sel)}</p><h2 className="mt-0.5 font-semibold leading-snug">{focusEv.title}</h2></div><Badge tone={focusEv.relevance === "alta" ? "success" : "neutral"}>{focusEv.relevance}</Badge></div>
              {focusEv.relevanceNote && <p className="mt-2 text-sm text-muted-foreground">{focusEv.relevanceNote}</p>}
              {focusEv.description && <p className="mt-1 text-sm">{focusEv.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">Recordatorios: {focusEv.reminders.length ? focusEv.reminders.map((d) => (d === 0 ? "mismo día" : `${d} d`)).join(", ") : "ninguno"}</p>
              <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(focusEv)}><Pencil />Editar</Button><Button size="sm" variant="ghost" onClick={() => setFocus(null)}>Cerrar</Button></div>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-semibold">{fmtDate(sel)}</h2>
            {dayEvents.length + dayTasks.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Sin eventos este día.</p>}
            <ul className="mt-2 space-y-2">
              {dayEvents.map((e) => <li key={e.id} className="rounded-lg border border-border p-3 text-sm"><div className="flex items-start justify-between gap-2"><button onClick={() => setFocus(e.id)} className="text-left"><b className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: EVENT_CATEGORIES[e.category].color }} />{e.title}</b></button><Badge tone={e.relevance === "alta" ? "success" : "neutral"}>{e.relevance}</Badge></div>{e.relevanceNote && <p className="mt-1 text-xs text-muted-foreground">{e.relevanceNote}</p>}</li>)}
              {dayTasks.map((t) => <li key={t.id}><Link href={`/videos?tarea=${t.id}`} className="block rounded-lg border border-border p-3 text-sm hover:bg-accent"><b>Entrega: {t.title}</b></Link></li>)}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" />Ideas para esta fecha</h2><Button size="sm" variant="brand" onClick={ideas} disabled={busy === "ideas"}>{busy === "ideas" ? "Pensando…" : "Pedir ideas"}</Button></div>
            {dayIdeas.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay ideas para esta fecha{dayEvent ? ` (${dayEvent.title})` : ""}. La IA las propone con tus productos y esta ocasión.</p> : (
              <ul className="space-y-2">{dayIdeas.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3 text-sm"><Link href={`/ideas?idea=${i.id}`} className="font-medium hover:text-primary">{i.title}</Link><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{i.concept}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="flex gap-1.5"><Badge>{i.platform}</Badge><Badge>{i.duration}</Badge></span><IdeaActions idea={i} compact /></div></li>))}</ul>
            )}
          </Card>
        </aside>
      </div>

      <Dialog open={!!f} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent title={f?.id ? "Editar evento" : "Nuevo evento"} description="Fechas, repetición y recordatorios.">
          {f && <div className="space-y-3">
            <Field label="Título"><Input autoFocus value={f.title} onChange={(e) => setForm({ ...f, title: e.target.value })} placeholder="Ej. Día Mundial del Agua" /></Field>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Fecha"><Input type="date" value={f.start} onChange={(e) => setForm({ ...f, start: e.target.value })} /></Field><Field label="Hora (opcional)"><Input type="time" value={f.time} onChange={(e) => setForm({ ...f, time: e.target.value })} /></Field><Field label="Hasta (varios días)"><Input type="date" value={f.end} onChange={(e) => setForm({ ...f, end: e.target.value })} /></Field></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo"><Select value={f.category} onChange={(e) => setForm({ ...f, category: e.target.value as EventCategory })}>{Object.entries(EVENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field><Field label="Repetición"><Select value={f.repeat} onChange={(e) => setForm({ ...f, repeat: e.target.value as typeof f.repeat })}><option value="none">No se repite</option><option value="yearly">Cada año</option><option value="monthly">Cada mes</option><option value="weekly">Cada semana</option><option value="custom">Cada N días</option></Select></Field></div>
            {f.repeat === "custom" && <Field label="Cada cuántos días"><Input type="number" min={1} value={f.interval} onChange={(e) => setForm({ ...f, interval: Number(e.target.value) })} /></Field>}
            <div><p className="mb-1.5 text-xs font-medium text-muted-foreground">Recordarme</p><div className="flex flex-wrap gap-2">{REMINDER_OPTIONS.map((d) => <button type="button" key={d} aria-pressed={f.reminders.includes(d)} onClick={() => setForm({ ...f, reminders: f.reminders.includes(d) ? f.reminders.filter((x) => x !== d) : [...f.reminders, d].sort((a, b) => b - a) })} className={`rounded-full border px-3 py-1 text-sm transition ${f.reminders.includes(d) ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{d} {d === 1 ? "día" : "días"} antes</button>)}</div></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Relevancia"><Select value={f.relevance} onChange={(e) => setForm({ ...f, relevance: e.target.value as typeof f.relevance })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option><option value="descartada">Descartada</option></Select></Field><Field label="Por qué importa"><Input value={f.relevanceNote} onChange={(e) => setForm({ ...f, relevanceNote: e.target.value })} /></Field></div>
            <Field label="Notas"><Textarea value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} /></Field>
            <div className="flex items-center justify-between gap-2">{f.id ? <Button variant="ghost" onClick={() => setDel(s.events.find((x) => x.id === f.id) ?? null)}><Trash2 />Borrar</Button> : <span />}<div className="flex gap-2"><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button variant="brand" onClick={save} disabled={f.title.trim().length < 3}>Guardar</Button></div></div>
          </div>}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger confirmLabel="Borrar" title="¿Borrar este evento?" description={del?.title} onConfirm={() => { update((st) => { st.events = st.events.filter((x) => x.id !== del!.id); }, `Borró el evento "${del!.title}"`); setForm(null); toast.success("Evento borrado"); }} />
    </>
  );
}

export default function CalendarioPage() { return <Suspense fallback={<PageSkeleton />}><Calendario /></Suspense>; }
