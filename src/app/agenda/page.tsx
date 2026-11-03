"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { generateIdeas } from "@/lib/actions";
import { occurrences } from "@/lib/domain";
import { useMe, userName } from "@/lib/store";
import { EVENT_CATEGORIES } from "@/lib/types";
import { addDays, fmtDate, todayLima } from "@/lib/utils";

export default function Agenda() {
  const { s, ready } = useMe();
  const [day, setDay] = useState(todayLima());
  const [busy, setBusy] = useState(false);
  if (!ready) return <PageSkeleton />;

  const events = s.events.filter((e) => e.relevance !== "descartada" && occurrences(e, day, day).length > 0);
  const tasks = s.tasks.filter((t) => t.due?.slice(0, 10) === day);
  const deliverables = s.deliverables.filter((d) => d.dueAt.slice(0, 10) === day);
  const reminders = s.events.filter((e) => e.relevance !== "descartada").flatMap((e) => e.reminders.filter((n) => n > 0).map((n) => ({ e, n })).filter(({ e: ev, n }) => occurrences(ev, addDays(day, n), addDays(day, n)).length > 0));
  const ideas = s.ideas.filter((i) => i.date === day || (i.status === "propuesta" && day === todayLima())).slice(0, 4);

  const suggest = async () => {
    setBusy(true);
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay });
    setBusy(false);
    if (r.ok) toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : ""}`); else toast.error(r.error);
  };
  const empty = !events.length && !tasks.length && !deliverables.length && !reminders.length;

  return (
    <>
      <PageHeader title="Agenda diaria" hint="Línea de tiempo del día: eventos, entregas, recordatorios y sugerencias."
        actions={<div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => setDay(addDays(day, -1))}><ChevronLeft /></Button><Input type="date" className="w-auto" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /><Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => setDay(addDays(day, 1))}><ChevronRight /></Button><Button variant="soft" onClick={() => setDay(todayLima())}>Hoy</Button></div>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{fmtDate(day)}</CardTitle></CardHeader>
          <CardContent>
            {empty ? <EmptyState icon={CheckCircle2} title="Día libre" text="No hay eventos ni entregas para esta fecha." /> : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {events.map((e) => <li key={e.id} className="relative"><span className="absolute -left-[26px] top-1.5 size-3 rounded-full ring-4 ring-card" style={{ background: EVENT_CATEGORIES[e.category].color }} /><Link href={`/eventos/${e.id}`} className="block rounded-md p-2 transition hover:bg-accent"><b className="text-sm">{e.title}</b><span className="block text-xs text-muted-foreground">{EVENT_CATEGORIES[e.category].label}{!e.allDay && ` · ${e.start.slice(11, 16)}`}</span></Link></li>)}
                {tasks.map((t) => <li key={t.id} className="relative"><span className="absolute -left-[26px] top-1.5 size-3 rounded-full bg-success ring-4 ring-card" /><Link href={`/produccion/tareas/${t.id}`} className="block rounded-md p-2 transition hover:bg-accent"><b className="text-sm">Entrega: {t.title}</b><span className="block text-xs text-muted-foreground">{userName(s, t.assigneeId)} · <Badge>{t.status}</Badge></span></Link></li>)}
                {deliverables.map((d) => <li key={d.id} className="relative"><span className="absolute -left-[26px] top-1.5 size-3 rounded-full bg-success ring-4 ring-card" /><Link href="/produccion/entregables" className="block rounded-md p-2 transition hover:bg-accent"><b className="text-sm">Entregable: {d.title}</b><span className="block text-xs text-muted-foreground">{userName(s, d.assigneeId)} · {d.receivedAt ? "recibido" : "pendiente"}</span></Link></li>)}
                {reminders.map(({ e, n }) => <li key={e.id + n} className="relative"><span className="absolute -left-[26px] top-1.5 size-3 rounded-full bg-brand ring-4 ring-card" /><Link href={`/eventos/${e.id}`} className="block rounded-md p-2 transition hover:bg-accent"><b className="text-sm">Recordatorio: “{e.title}” en {n} días</b><span className="block text-xs text-muted-foreground">Fecha: {fmtDate(addDays(day, n))}</span></Link></li>)}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand" />Sugerencias</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ideas.length === 0 ? <p className="text-sm text-muted-foreground">Sin ideas para hoy. Pide propuestas nuevas.</p> : <ul className="space-y-2">{ideas.map((i) => <li key={i.id}><Link href={`/ia/debate?idea=${i.id}`} className="block rounded-md border border-border p-3 text-sm transition hover:bg-accent"><b className="line-clamp-2">{i.title}</b><span className="text-xs text-muted-foreground">{i.network}</span></Link></li>)}</ul>}
            <Button variant="brand" size="sm" onClick={suggest} disabled={busy}><Sparkles />{busy ? "Generando…" : `Pedir ${s.prefs.ideasPerDay} ideas`}</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
