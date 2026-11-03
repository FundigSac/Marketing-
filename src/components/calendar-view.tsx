"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput } from "@fullcalendar/core";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button, Dialog, DialogContent, Field, Input, Select } from "@/components/ui/primitives";
import { occurrences } from "@/lib/domain";
import { update, useMe } from "@/lib/store";
import { can, EVENT_CATEGORIES, type EventCategory } from "@/lib/types";
import { addDays, uid } from "@/lib/utils";

type View = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listMonth";

export function CalendarView({ initialView = "dayGridMonth" }: { initialView?: View }) {
  const { s, me } = useMe();
  const router = useRouter();
  const ref = useRef<FullCalendar>(null);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [campaign, setCampaign] = useState("");
  const [cats, setCats] = useState<Set<EventCategory>>(new Set(Object.keys(EVENT_CATEGORIES) as EventCategory[]));
  const [quick, setQuick] = useState<{ date: string } | null>(null);
  const [qTitle, setQTitle] = useState("");
  const [qCat, setQCat] = useState<EventCategory>("marketing");
  const canWrite = me ? can(me.role, "events.write") : false;

  const source = useMemo(() => (info: { startStr: string; endStr: string }, ok: (e: EventInput[]) => void) => {
    const from = info.startStr.slice(0, 10), to = addDays(info.endStr.slice(0, 10), -1);
    const out: EventInput[] = [];
    for (const e of s.events) {
      if (e.relevance === "descartada" || !cats.has(e.category)) continue;
      if (q && !e.title.toLowerCase().includes(q.toLowerCase())) continue;
      if (owner && e.ownerId !== owner) continue;
      if (campaign && e.campaignId !== campaign) continue;
      const color = EVENT_CATEGORIES[e.category].color;
      const recurring = e.repeat && e.repeat !== "none";
      for (const date of occurrences(e, from, to)) {
        const span = !recurring && e.end ? e.end.slice(0, 10) : undefined;
        const timed = !e.allDay && e.start.length > 10;
        out.push({
          id: e.id + "|" + date, title: e.title, backgroundColor: color, borderColor: color, editable: canWrite && !recurring,
          start: timed ? `${date}${e.start.slice(10)}` : date,
          end: timed && e.end ? `${date}${e.end.slice(10)}` : span ? addDays(span, 1) : undefined,
          allDay: !timed, extendedProps: { kind: "event", eventId: e.id },
        });
      }
    }
    if (cats.has("entrega")) {
      for (const t of s.tasks) {
        if (!t.due || (owner && t.assigneeId !== owner) || (campaign && t.campaignId !== campaign)) continue;
        if (q && !t.title.toLowerCase().includes(q.toLowerCase())) continue;
        if (t.due.slice(0, 10) >= from && t.due.slice(0, 10) <= to) out.push({ id: "t|" + t.id, title: "Entrega: " + t.title, start: t.due.slice(0, 10), allDay: true, backgroundColor: EVENT_CATEGORIES.entrega.color, borderColor: EVENT_CATEGORIES.entrega.color, editable: false, extendedProps: { kind: "task", taskId: t.id } });
      }
      for (const d of s.deliverables) {
        if (d.receivedAt || (owner && d.assigneeId !== owner)) continue;
        if (q && !d.title.toLowerCase().includes(q.toLowerCase())) continue;
        if (d.dueAt.slice(0, 10) >= from && d.dueAt.slice(0, 10) <= to) out.push({ id: "d|" + d.id, title: "Entregable: " + d.title, start: d.dueAt.slice(0, 10), allDay: true, backgroundColor: EVENT_CATEGORIES.entrega.color, borderColor: EVENT_CATEGORIES.entrega.color, editable: false, extendedProps: { kind: "deliverable" } });
      }
    }
    ok(out);
  }, [s.events, s.tasks, s.deliverables, q, owner, campaign, cats, canWrite]);

  const toggleCat = (c: EventCategory) => setCats((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const createQuick = () => {
    if (!quick || !qTitle.trim()) return;
    update((st) => { st.events.push({ id: uid(), title: qTitle.trim(), category: qCat, start: quick.date, allDay: true, repeat: "none", reminders: [1, 0], relevance: "media", source: "manual", taskIds: [], ideaIds: [] }); }, `Creó el evento "${qTitle.trim()}"`);
    toast.success("Evento creado");
    setQuick(null); setQTitle("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar evento…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Responsable" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-auto"><option value="">Todos los responsables</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Select aria-label="Campaña" value={campaign} onChange={(e) => setCampaign(e.target.value)} className="w-auto"><option value="">Todas las campañas</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Ir a<Input type="date" className="w-auto" onChange={(e) => e.target.value && ref.current?.getApi().gotoDate(e.target.value)} /></label>
        {canWrite && <Button variant="brand" onClick={() => router.push("/eventos/nuevo")} className="ml-auto">Nuevo evento</Button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(EVENT_CATEGORIES) as [EventCategory, { label: string; color: string }][]).map(([k, v]) => (
          <button key={k} onClick={() => toggleCat(k)} aria-pressed={cats.has(k)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${cats.has(k) ? "border-transparent bg-card shadow-[var(--shadow-sm)]" : "border-dashed opacity-50"}`}>
            <i className="size-2 rounded-full" style={{ background: v.color }} />{v.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-sm)] sm:p-4">
        <FullCalendar
          ref={ref} plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} locale={esLocale} firstDay={1}
          initialView={initialView} height="auto" navLinks nowIndicator dayMaxEvents={3} selectable={canWrite} editable={canWrite}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día", list: "Agenda" }}
          events={source}
          dateClick={(i) => canWrite && setQuick({ date: i.dateStr.slice(0, 10) })}
          eventClick={(i) => {
            const p = i.event.extendedProps;
            if (p.kind === "event") router.push(`/eventos/${p.eventId}`);
            else if (p.kind === "task") router.push(`/produccion/tareas/${p.taskId}`);
            else router.push("/produccion/entregables");
          }}
          eventDrop={(i) => {
            const p = i.event.extendedProps;
            if (p.kind !== "event" || !i.event.start) { i.revert(); return; }
            const start = i.event.startStr, end = i.event.endStr ? (i.event.allDay ? addDays(i.event.endStr.slice(0, 10), -1) : i.event.endStr) : undefined;
            update((st) => { const e = st.events.find((x) => x.id === p.eventId); if (e) { e.start = start; e.end = end; } }, `Movió el evento "${i.event.title}" a ${start.slice(0, 10)}`);
            toast.success("Evento reorganizado");
          }}
          select={(i) => i.end.getTime() - i.start.getTime() > 86400000 * 1.5 && setQuick({ date: i.startStr.slice(0, 10) })}
        />
      </div>
      <p className="text-xs text-muted-foreground">Arrastra los eventos únicos para moverlos. Los eventos repetidos se editan desde su ficha para no desordenar toda la serie.</p>

      <Dialog open={!!quick} onOpenChange={(o) => !o && setQuick(null)}>
        <DialogContent title="Evento rápido" description={quick ? `Para el ${quick.date.split("-").reverse().join("/")}` : ""}>
          <div className="space-y-3">
            <Field label="Título"><Input autoFocus value={qTitle} onChange={(e) => setQTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createQuick()} placeholder="Ej. Grabación de video de codos HDPE" /></Field>
            <Field label="Tipo"><Select value={qCat} onChange={(e) => setQCat(e.target.value as EventCategory)}>{Object.entries(EVENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setQuick(null)}>Cancelar</Button><Button onClick={createQuick} disabled={!qTitle.trim()}>Crear</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
