"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { CalendarClock, Paperclip, Plus } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Input, Progress, Select } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { addTask, moveTask } from "@/lib/actions";
import { isOverdue, taskProgress } from "@/lib/domain";
import { productName, useMe, userName } from "@/lib/store";
import { can, CONTENT_TYPES, TASK_COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { fmtDate, todayLima } from "@/lib/utils";

const PRIO = { alta: "danger", media: "warning", baja: "neutral" } as const;
const FKEY = "kanban-filters";

function Card_({ t, today, s, me }: { t: Task; today: string; s: ReturnType<typeof useMe>["s"]; me: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id, disabled: !me });
  const late = isOverdue(t, today);
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      className={`rounded-lg border bg-card p-3 text-sm shadow-[var(--shadow-sm)] transition-shadow ${late ? "border-destructive/60" : "border-border"} ${isDragging ? "relative z-20 rotate-1 shadow-[var(--shadow-lg)]" : "hover:shadow-[var(--shadow-md)]"}`}>
      <div {...listeners} {...attributes} className={me ? "cursor-grab touch-none" : ""}>
        <Link href={`/produccion/tareas/${t.id}`} onPointerDown={(e) => e.stopPropagation()} className="line-clamp-2 font-medium hover:text-primary">{t.title}</Link>
        <p className="mt-1 text-xs text-muted-foreground">{userName(s, t.assigneeId)}{t.productId && ` · ${productName(s, t.productId)}`}{t.contentType && ` · ${t.contentType}`}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge tone={PRIO[t.priority]}>{t.priority}</Badge>{t.due && <Badge tone={late ? "danger" : "neutral"}><CalendarClock className="size-3" />{fmtDate(t.due)}</Badge>}{t.attachments.length > 0 && <Badge><Paperclip className="size-3" />{t.attachments.length}</Badge>}</div>
        <Progress value={taskProgress(t)} className="mt-2 h-1.5" tone={late ? "brand" : "primary"} />
      </div>
    </div>
  );
}

function Column({ id, label, tasks, today, s, canMove }: { id: TaskStatus; label: string; tasks: Task[]; today: string; s: ReturnType<typeof useMe>["s"]; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-xl border p-2.5 transition-colors ${isOver ? "border-primary bg-secondary/60" : "border-border bg-muted/50"}`}>
      <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<span className="rounded-full bg-card px-2 py-0.5 text-foreground">{tasks.length}</span></h3>
      <div className="min-h-16 flex-1 space-y-2">{tasks.map((t) => <Card_ key={t.id} t={t} today={today} s={s} me={canMove} />)}</div>
    </div>
  );
}

function Kanban() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const q = useSearchParams();
  const [open, setOpen] = useState(q.get("nueva") === "1");
  const [filters, setFilters] = useState({ who: "", product: "", type: "", prio: "" });
  const [f, setF] = useState({ title: "", assigneeId: "", due: "", priority: "media" as Task["priority"], productId: "", contentType: "" });
  useEffect(() => { try { const v = localStorage.getItem(FKEY); if (v) setFilters(JSON.parse(v)); } catch {} }, []);
  const setFilter = (k: keyof typeof filters, v: string) => setFilters((p) => { const n = { ...p, [k]: v }; try { localStorage.setItem(FKEY, JSON.stringify(n)); } catch {} return n; });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  if (!ready || !me) return <PageSkeleton />;

  const today = todayLima();
  const canWrite = can(me.role, "tasks.write");
  const tasks = s.tasks.filter((t) => (!filters.who || t.assigneeId === filters.who) && (!filters.product || t.productId === filters.product) && (!filters.type || t.contentType === filters.type) && (!filters.prio || t.priority === filters.prio));

  const onEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const to = e.over.id as TaskStatus, id = String(e.active.id);
    const t = s.tasks.find((x) => x.id === id);
    if (!t || t.status === to) return;
    if (to === "aprobado") {
      const v = s.videos.find((x) => x.taskId === id);
      if (v && v.notes.some((n) => n.mandatory && !n.resolved)) { toast.error("No se puede aprobar: el video tiene correcciones obligatorias pendientes."); return; }
    }
    moveTask(id, to, me.id);
  };

  const create = () => {
    if (!f.title.trim()) return;
    const id = addTask({ title: f.title.trim(), assigneeId: f.assigneeId || undefined, due: f.due || undefined, priority: f.priority, productId: f.productId || undefined, contentType: f.contentType || undefined }, me.id);
    toast.success("Tarea creada", { action: { label: "Abrir", onClick: () => router.push(`/produccion/tareas/${id}`) } });
    setOpen(false); setF({ ...f, title: "", due: "" });
  };

  return (
    <>
      <PageHeader title="Kanban editorial" hint="Arrastra las tarjetas entre estados. Cada cambio queda registrado con quién y cuándo."
        actions={canWrite ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Nueva tarea</Button> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Responsable" className="w-auto" value={filters.who} onChange={(e) => setFilter("who", e.target.value)}><option value="">Todos los responsables</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Select aria-label="Producto" className="w-auto" value={filters.product} onChange={(e) => setFilter("product", e.target.value)}><option value="">Todos los productos</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select aria-label="Tipo" className="w-auto" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}><option value="">Todo tipo de contenido</option>{CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select aria-label="Prioridad" className="w-auto" value={filters.prio} onChange={(e) => setFilter("prio", e.target.value)}><option value="">Toda prioridad</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select>
      </div>
      <DndContext sensors={sensors} onDragEnd={onEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
          {TASK_COLUMNS.map((c) => <Column key={c.id} id={c.id} label={c.label} s={s} today={today} canMove={canWrite} tasks={tasks.filter((t) => t.status === c.id)} />)}
        </div>
      </DndContext>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Nueva tarea" description="Asigna responsable y fecha límite.">
          <div className="space-y-3">
            <Field label="Título"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Video de conexión HDPE" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Responsable"><Select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
              <Field label="Fecha límite"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
              <Field label="Prioridad"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Task["priority"] })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select></Field>
              <Field label="Producto"><Select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">—</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Tipo de contenido"><Select value={f.contentType} onChange={(e) => setF({ ...f, contentType: e.target.value })}><option value="">—</option>{CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </div>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create} disabled={!f.title.trim()}>Crear tarea</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function KanbanPage() { return <Suspense fallback={<PageSkeleton />}><Kanban /></Suspense>; }
