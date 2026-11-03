"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Lightbulb, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Progress } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { IdeaCard } from "@/components/idea-card";
import { generateIdeas } from "@/lib/actions";
import { avgProgress, nextOccurrence } from "@/lib/domain";
import { update, useMe, userName } from "@/lib/store";
import { can, EVENT_CATEGORIES } from "@/lib/types";
import { daysBetween, fmtDate, todayLima } from "@/lib/utils";

export default function DetalleEvento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, me, ready } = useMe();
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  if (!ready || !me) return <PageSkeleton />;
  const e = s.events.find((x) => x.id === id);
  if (!e) return <EmptyState icon={CalendarClock} title="Evento no encontrado" action={<Button asChild><Link href="/calendario">Volver al calendario</Link></Button>} />;

  const today = todayLima();
  const next = nextOccurrence(e, today);
  const tasks = s.tasks.filter((t) => t.eventId === e.id);
  const ideas = s.ideas.filter((i) => i.eventId === e.id);
  const canWrite = can(me.role, "events.write");
  const cat = EVENT_CATEGORIES[e.category];

  const suggest = async () => {
    setBusy(true);
    const r = await generateIdeas(s, { count: 3, eventId: e.id });
    setBusy(false);
    if (r.ok) toast.success(`${r.n} ideas propuestas${r.note ? ` · ${r.note}` : ""}`); else toast.error(r.error);
  };

  return (
    <>
      <PageHeader eyebrow={cat.label} title={e.title} hint={e.description}
        actions={canWrite ? <><Button variant="outline" asChild><Link href={`/eventos/${e.id}/editar`}><Pencil />Editar</Link></Button><Button variant="outline" onClick={() => setDel(true)}><Trash2 />Borrar</Button></> : undefined} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Ficha</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">Inicio</span><b>{fmtDate(e.start)}{!e.allDay && ` · ${e.start.slice(11, 16)}`}</b></p>
            {e.end && <p className="flex justify-between"><span className="text-muted-foreground">Fin</span><b>{fmtDate(e.end)}</b></p>}
            <p className="flex justify-between"><span className="text-muted-foreground">Repetición</span><b>{{ none: "No se repite", yearly: "Cada año", monthly: "Cada mes", weekly: "Cada semana", custom: `Cada ${e.repeatInterval} días` }[e.repeat ?? "none"]}</b></p>
            {next && <p className="flex justify-between"><span className="text-muted-foreground">Próxima fecha</span><b>{fmtDate(next)} · {daysBetween(today, next) === 0 ? "hoy" : `en ${daysBetween(today, next)} d`}</b></p>}
            <p className="flex justify-between"><span className="text-muted-foreground">Responsable</span><b>{userName(s, e.ownerId)}</b></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Relevancia</span><Badge tone={e.relevance === "alta" ? "success" : e.relevance === "descartada" ? "danger" : "neutral"}>{e.relevance}</Badge></p>
            {e.relevanceNote && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{e.relevanceNote}</p>}
            <div><p className="mb-1.5 text-xs text-muted-foreground">Recordatorios</p><div className="flex flex-wrap gap-1.5">{e.reminders.length ? e.reminders.map((d) => <Badge key={d} tone="primary">{d === 0 ? "El mismo día" : `${d} d antes`}</Badge>) : <span className="text-xs text-muted-foreground">Ninguno</span>}</div></div>
            <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Avance de tareas</span><b className="text-foreground">{avgProgress(tasks)}%</b></div><Progress value={avgProgress(tasks)} tone="brand" /></div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-brand" />Ideas para esta fecha</CardTitle>{canWrite && <Button size="sm" variant="brand" onClick={suggest} disabled={busy}><Sparkles />{busy ? "Generando…" : "Proponer ideas"}</Button>}</CardHeader>
            <CardContent>
              {ideas.length === 0 ? <EmptyState icon={Lightbulb} title="Aún no hay ideas" text="Pide ideas para esta fecha. Elige una y asígnala al equipo." /> : <div className="grid gap-4 xl:grid-cols-2">{ideas.map((i) => <IdeaCard key={i.id} idea={i} />)}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tareas asociadas</CardTitle></CardHeader>
            <CardContent>
              {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin tareas. Se crean al asignar una idea elegida.</p> : (
                <ul className="divide-y divide-border">{tasks.map((t) => <li key={t.id}><Link href={`/produccion/tareas/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"><span className="truncate">{t.title}</span><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{userName(s, t.assigneeId)}<Badge>{t.status}</Badge></span></Link></li>)}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={del} onOpenChange={setDel} title="¿Borrar este evento?" description="Las tareas e ideas asociadas se conservan, pero dejarán de estar vinculadas." danger confirmLabel="Borrar"
        onConfirm={() => { update((st) => { st.events = st.events.filter((x) => x.id !== e.id); }, `Borró el evento "${e.title}"`); toast.success("Evento borrado"); router.push("/calendario"); }} />
    </>
  );
}
