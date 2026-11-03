"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CheckCircle2, Film, Plus, Trash2, Wrench } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Progress, Select } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton, StatCard } from "@/components/ui/blocks";
import { avgProgress, isOverdue, taskProgress } from "@/lib/domain";
import { update, useMe } from "@/lib/store";
import { can } from "@/lib/types";
import { addDays, daysBetween, fmtDate, todayLima, uid } from "@/lib/utils";

const DOW = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function nextDateForWeekday(dow: number, from: string) {
  const d = new Date(from + "T00:00:00").getDay();
  return addDays(from, (dow - d + 7) % 7);
}

export default function PanelFabrizio() {
  const { s, me, ready } = useMe();
  const [personId, setPersonId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [newDow, setNewDow] = useState(2);
  const [newLabel, setNewLabel] = useState("");
  const today = todayLima();
  const person = useMemo(() => (ready ? s.users.find((u) => u.id === (personId || s.users.find((x) => x.name === "Fabrizio")?.id || s.users[0]?.id)) : undefined), [ready, s.users, personId]);
  if (!ready || !me || !person) return <PageSkeleton />;

  const canWrite = can(me.role, "tasks.write");
  const tasks = s.tasks.filter((t) => t.assigneeId === person.id);
  const open = tasks.filter((t) => !["publicado", "analizado"].includes(t.status));
  const late = open.filter((t) => isOverdue(t, today));
  const dels = s.deliverables.filter((d) => d.assigneeId === person.id);
  const pendingDels = dels.filter((d) => !d.receivedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const myVideos = s.videos.filter((v) => open.some((t) => t.id === v.taskId));
  const pendingVideos = myVideos.filter((v) => v.status !== "aprobado");
  const corrections = [
    ...myVideos.flatMap((v) => v.notes.filter((n) => !n.resolved).map((n) => ({ key: n.id, text: `${v.title}: ${n.text}`, href: `/produccion/videos/${v.id}` }))),
    ...dels.filter((d) => d.corrections).map((d) => ({ key: d.id, text: `${d.title}: ${d.corrections}`, href: "/produccion/entregables" })),
    ...open.filter((t) => t.status === "cambios").map((t) => ({ key: t.id, text: `${t.title}: requiere cambios`, href: `/produccion/tareas/${t.id}` })),
  ];
  const nextAvance = pendingDels[0];

  const plan = () => {
    if (!taskId) { toast.error("Elige la tarea a la que pertenecen las entregas."); return; }
    update((st) => {
      for (const e of st.schedule) {
        const dueAt = nextDateForWeekday(e.weekday, today);
        if (st.deliverables.some((d) => d.taskId === taskId && d.kind === e.kind && d.dueAt.slice(0, 10) === dueAt)) continue;
        st.deliverables.push({ id: uid(), taskId, title: `${e.label} · ${st.tasks.find((t) => t.id === taskId)?.title ?? ""}`, kind: e.kind, assigneeId: person.id, dueAt });
      }
    }, `Programó las entregas semanales de ${person.name}`);
    toast.success("Entregas de la semana programadas");
  };

  return (
    <>
      <PageHeader title={`Panel de ${person.name}`} hint="Qué desarrolla, qué debe entregar, cuánto lleva y qué está atrasado."
        actions={<Select aria-label="Persona" className="w-auto" value={person.id} onChange={(e) => setPersonId(e.target.value)}>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avance promedio" value={avgProgress(open)} format={(n) => `${Math.round(n)}%`} icon={CheckCircle2} tone="success" sub={`${open.length} tareas abiertas`} />
        <StatCard label="Atrasadas" value={late.length} icon={AlertTriangle} tone={late.length ? "danger" : "primary"} />
        <StatCard label="Videos pendientes" value={pendingVideos.length} icon={Film} tone="brand" />
        <StatCard label="Correcciones por hacer" value={corrections.length} icon={Wrench} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>En qué está trabajando</CardTitle></CardHeader>
          <CardContent>
            {open.length === 0 ? <p className="text-sm text-muted-foreground">Sin tareas abiertas. Asigna una desde el Kanban.</p> : (
              <ul className="divide-y divide-border">{open.map((t) => (
                <li key={t.id} className="py-3"><Link href={`/produccion/tareas/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm"><b className="hover:text-primary">{t.title}</b><span className="flex items-center gap-2 text-xs text-muted-foreground">{t.due && <span className={isOverdue(t, today) ? "text-destructive" : ""}>{isOverdue(t, today) ? "Atrasada · " : "Entrega "}{fmtDate(t.due)}</span>}<Badge>{t.status}</Badge></span></Link><Progress value={taskProgress(t)} className="mt-2 h-1.5" tone="brand" /></li>
              ))}</ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">El % sale del estado de cada tarea y de sus pasos completados (ver detalle de tarea). No se estima a mano.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-brand" />Próximo avance</CardTitle></CardHeader>
          <CardContent>{nextAvance ? <div className="space-y-1 text-sm"><b>{nextAvance.title}</b><p className="text-muted-foreground">{fmtDate(nextAvance.dueAt)} · {daysBetween(today, nextAvance.dueAt) < 0 ? `atrasado ${-daysBetween(today, nextAvance.dueAt)} d` : daysBetween(today, nextAvance.dueAt) === 0 ? "hoy" : `en ${daysBetween(today, nextAvance.dueAt)} d`}</p></div> : <p className="text-sm text-muted-foreground">No hay entregas pendientes programadas.</p>}</CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Qué debe entregar</CardTitle><Link href="/produccion/entregables" className="text-xs text-primary hover:underline">Control de entregables</Link></CardHeader>
          <CardContent>{pendingDels.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendiente.</p> : <ul className="divide-y divide-border">{pendingDels.map((d) => <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{d.title}</span><Badge tone={d.dueAt.slice(0, 10) < today ? "danger" : "primary"}>{d.dueAt.slice(0, 10) < today ? "atrasado · " : ""}{fmtDate(d.dueAt)}</Badge></li>)}</ul>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Correcciones pendientes</CardTitle></CardHeader>
          <CardContent>{corrections.length === 0 ? <p className="text-sm text-muted-foreground">Sin correcciones.</p> : <ul className="space-y-2 text-sm">{corrections.slice(0, 8).map((c) => <li key={c.key}><Link href={c.href} className="block rounded-md p-2 hover:bg-accent">{c.text}</Link></li>)}</ul>}</CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Calendario semanal de entregas (editable)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{s.schedule.sort((a, b) => a.weekday - b.weekday).map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm"><span><b>{DOW[e.weekday]}</b><br /><span className="text-muted-foreground">{e.label}</span></span>{canWrite && <button aria-label="Quitar" className="text-muted-foreground hover:text-destructive" onClick={() => update((st) => { st.schedule = st.schedule.filter((x) => x.id !== e.id); })}><Trash2 className="size-4" /></button>}</li>
            ))}</ul>
            {canWrite && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Día"><Select value={newDow} onChange={(e) => setNewDow(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DOW[d]}</option>)}</Select></Field>
                <Field label="Qué debe enviar"><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ej. Segundo avance" /></Field>
                <Button variant="outline" disabled={!newLabel.trim()} onClick={() => { update((st) => { st.schedule.push({ id: uid(), weekday: newDow, label: newLabel.trim(), kind: "otro" }); }); setNewLabel(""); }}><Plus />Agregar día</Button>
                <Field label="Generar entregas para la tarea"><Select value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Elige tarea…</option>{open.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
                <Button variant="brand" onClick={plan}>Programar esta semana</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Los días son un ejemplo de arranque (martes borrador, miércoles revisión, jueves correcciones, viernes final). Cámbialos libremente. Al programar, cada día se convierte en un entregable con fecha.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
