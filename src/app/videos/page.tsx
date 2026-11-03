"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { CalendarClock, Check, CheckCircle2, ExternalLink, History as HistoryIcon, MessageSquareWarning, Paperclip, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, Field, Input, Progress, Select, Tabs, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import { CountUp, EmptyState, Item, PageHeader, PageSkeleton, Ring, Stagger } from "@/components/ui/blocks";
import { TaskDialog } from "@/components/task-dialog";
import { useFileUrl } from "@/components/use-file-url";
import { attachFile, moveTask, requestChanges } from "@/lib/actions";
import { compliance, isOverdue, taskProgress } from "@/lib/domain";
import { productName, update, useMe, userName } from "@/lib/store";
import { COLUMNS, PLATFORMS, type Column, type Task } from "@/lib/types";
import { fmtDate, fmtDateTime, mmss, NUM, todayLima, uid } from "@/lib/utils";


const PRIO = { alta: "danger", media: "warning", baja: "neutral" } as const;

function Tile({ t, today, canDrag, onOpen }: { t: Task; today: string; canDrag: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id, disabled: !canDrag });
  const late = isOverdue(t, today), pend = t.notes.filter((n) => !n.resolved).length;
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }} className={`rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-sm)] transition-shadow ${late ? "border-destructive/60" : "border-border"} ${isDragging ? "relative z-20 rotate-1 shadow-[var(--shadow-lg)]" : "hover:shadow-[var(--shadow-md)]"}`}>
      <div {...listeners} {...attributes} className={canDrag ? "cursor-grab touch-none" : ""}>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onOpen} className="line-clamp-2 text-left font-medium hover:text-primary">{t.title}</button>
        <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge tone={PRIO[t.priority]}>{t.priority}</Badge>{t.due && <Badge tone={late ? "danger" : "neutral"}><CalendarClock className="size-3" />{fmtDate(t.due)}</Badge>}{t.files.length > 0 && <Badge><Paperclip className="size-3" />{t.files.length}</Badge>}{t.changes && <Badge tone="warning">Correcciones</Badge>}{pend > 0 && <Badge tone="danger"><MessageSquareWarning className="size-3" />{pend}</Badge>}</div>
        <div className="mt-2 flex items-center gap-2"><Progress value={taskProgress(t)} className="h-1.5" tone={late ? "brand" : "primary"} /><span className="text-[11px] tabular-nums text-muted-foreground">{taskProgress(t)}%</span></div>
      </div>
    </div>
  );
}

function Col({ id, label, tasks, today, canDrag, onOpen }: { id: Column; label: string; tasks: Task[]; today: string; canDrag: boolean; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex w-60 shrink-0 flex-col rounded-2xl p-2.5 transition-colors lg:w-auto lg:min-w-0 ${isOver ? "bg-secondary" : "bg-muted/60"}`}>
      <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<span className="rounded-full bg-card px-2 py-0.5 text-foreground">{tasks.length}</span></h3>
      <div className="min-h-20 flex-1 space-y-2">{tasks.map((t) => <Tile key={t.id} t={t} today={today} canDrag={canDrag} onOpen={() => onOpen(t.id)} />)}</div>
    </div>
  );
}

function Sheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { s, me } = useMe();
  const [fileId, setFileId] = useState<string | undefined>();
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [item, setItem] = useState("");
  const [time, setTime] = useState(0);
  const [pubUrl, setPubUrl] = useState("");
  const [del, setDel] = useState(false);
  const vref = useRef<HTMLVideoElement>(null);
  const t = s.tasks?.find((x) => x.id === id);
  const current = t?.files.find((f) => f.id === fileId) ?? t?.files[t.files.length - 1];
  const { url } = useFileUrl(current?.id);
  if (!t || !me) return <Dialog open={false} onOpenChange={onClose}><DialogContent side title="Video"><span /></DialogContent></Dialog>;

  const reviewer = me.role === "reviewer";
  const patch = (fn: (x: Task) => void, log?: string) => update((st) => { fn(st.tasks.find((y) => y.id === t.id)!); }, log);
  const move = (to: Column) => { const r = moveTask(t.id, to, me.id); r.ok ? toast.success(`Movido a ${COLUMNS.find((c) => c.id === to)!.label}`) : toast.error(r.error); return r.ok; };
  const pending = t.notes.filter((n) => n.mandatory && !n.resolved).length;
  const notes = t.notes.filter((n) => n.fileId === current?.id).sort((a, b) => a.at - b.at);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const fid = await attachFile(t.id, files[0], me.id);
    setFileId(fid);
    toast.success(`Avance v${t.files.length + 1} adjuntado`);
  };
  const addNote = () => {
    if (!note.trim() || !current) return;
    const at = Math.round((vref.current?.currentTime ?? time) * 10) / 10;
    patch((x) => { x.notes.push({ id: uid(), fileId: current.id, at, text: note.trim(), mandatory, resolved: false, byId: me.id, createdAt: new Date().toISOString() }); }, `Dejó feedback en ${mmss(at)} de "${t.title}"`);
    setNote("");
  };
  const askChanges = () => { const r = requestChanges(t.id, me.id); r.ok ? toast.success("Correcciones solicitadas") : toast.error(r.error); };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side title={t.title} description={`${COLUMNS.find((c) => c.id === t.status)!.label} · ${taskProgress(t)}% de avance`} className="max-w-xl">
        <div className="space-y-5 text-sm">
          <div><Progress value={taskProgress(t)} tone="brand" /><p className="mt-1 text-xs text-muted-foreground">Avance = estado ({COLUMNS.find((c) => c.id === t.status)!.label}) + pasos completados de la lista. No es una estimación manual.</p></div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrega"><Input type="date" value={t.due?.slice(0, 10) ?? ""} onChange={(e) => patch((x) => { x.due = e.target.value || undefined; })} /></Field>
            <Field label="Prioridad"><Select value={t.priority} onChange={(e) => patch((x) => { x.priority = e.target.value as Task["priority"]; })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select></Field>
            <Field label="Plataforma"><Select value={t.platform ?? ""} onChange={(e) => patch((x) => { x.platform = e.target.value || undefined; })}><option value="">—</option>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Field label="Producto"><Select value={t.productId ?? ""} onChange={(e) => patch((x) => { x.productId = e.target.value || undefined; })}><option value="">—</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <Field label="Guion / notas"><Textarea value={t.description ?? ""} onChange={(e) => patch((x) => { x.description = e.target.value; })} className="min-h-24" /></Field>

          <div>
            <p className="mb-2 font-medium">Pasos {t.checklist.filter((c) => c.done).length}/{t.checklist.length}</p>
            <ul className="space-y-1.5">{t.checklist.map((c) => <li key={c.id}><label className="flex items-center gap-2"><input type="checkbox" checked={c.done} onChange={() => patch((x) => { const y = x.checklist.find((q) => q.id === c.id)!; y.done = !y.done; })} /><span className={c.done ? "text-muted-foreground line-through" : ""}>{c.text}</span></label></li>)}</ul>
            <div className="mt-2 flex gap-2"><Input placeholder="Agregar paso…" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { patch((x) => { x.checklist.push({ id: uid(), text: item.trim(), done: false }); }); setItem(""); } }} /></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><p className="font-medium">Video de avance</p><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:brightness-110"><Upload className="size-4" />Subir avance<input type="file" accept="video/*,image/*,.pdf" hidden onChange={(e) => upload(e.target.files)} /></label></div>
            {t.files.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground">Aún no hay video adjunto. Sube tu primer avance.</p> : (
              <>
                <div className="flex flex-wrap gap-1.5">{t.files.map((f) => <button key={f.id} onClick={() => setFileId(f.id)} className={`rounded-full border px-3 py-1 text-xs transition ${current?.id === f.id ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>v{f.version} · {f.name.slice(0, 18)}</button>)}</div>
                {url && (/\.(mp4|webm|mov|m4v)$/i.test(current!.name) || true) ? <video ref={vref} src={url} controls className="max-h-64 w-full rounded-lg bg-black" onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} /> : <div className="skeleton h-40" />}
                <p className="text-xs text-muted-foreground">Subido por {userName(s, current!.byId)} · {fmtDateTime(current!.at)}</p>
                <div>
                  <p className="mb-1.5 font-medium">Feedback por segundo ({notes.filter((n) => !n.resolved).length} pendientes)</p>
                  {notes.length === 0 ? <p className="text-muted-foreground">Sin observaciones en esta versión.</p> : <ul className="divide-y divide-border">{notes.map((n) => <li key={n.id} className="flex items-start gap-2.5 py-2"><input type="checkbox" className="mt-1" aria-label="Marcar como corregida" checked={n.resolved} onChange={() => patch((x) => { const y = x.notes.find((q) => q.id === n.id)!; y.resolved = !y.resolved; }, "Marcó una corrección")} /><div className="min-w-0 flex-1"><button onClick={() => { if (vref.current) { vref.current.currentTime = n.at; vref.current.pause(); } }} className="font-mono font-semibold text-primary hover:underline">{mmss(n.at)}</button> <span className={n.resolved ? "text-muted-foreground line-through" : ""}>{n.text}</span><p className="text-xs text-muted-foreground">{userName(s, n.byId)} · {n.mandatory ? <span className={n.resolved ? "text-success" : "text-destructive"}>{n.resolved ? "corregida" : "obligatoria"}</span> : "sugerencia"}</p></div></li>)}</ul>}
                  {reviewer && <div className="mt-2 space-y-2"><div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder={`Observación en ${mmss(time)}…`} /><Button variant="outline" onClick={addNote} disabled={!note.trim()}>Anotar</Button></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />Corrección obligatoria</label></div>}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-medium">Comentarios</p>
            {t.comments.length === 0 && <p className="text-muted-foreground">Sin comentarios.</p>}
            {t.comments.map((c) => <div key={c.id} className="rounded-lg bg-muted p-3"><b>{userName(s, c.byId)}</b> <span className="text-xs text-muted-foreground">{fmtDateTime(c.at)}</span><p className="mt-1 whitespace-pre-wrap">{c.text}</p></div>)}
            <div className="flex gap-2"><Input placeholder={reviewer ? "Escribe tu feedback…" : "Escribe un comentario…"} value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { patch((x) => { x.comments.push({ id: uid(), byId: me.id, at: new Date().toISOString(), text: comment.trim() }); }); setComment(""); } }} /><Button variant="outline" size="icon" aria-label="Enviar" disabled={!comment.trim()} onClick={() => { patch((x) => { x.comments.push({ id: uid(), byId: me.id, at: new Date().toISOString(), text: comment.trim() }); }); setComment(""); }}><Send /></Button></div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {!reviewer && ["todo", "edicion"].includes(t.status) && <Button variant="brand" onClick={() => move("revision")}><Send />{t.changes ? "Enviar correcciones a revisión" : "Enviar a revisión"}</Button>}
            {reviewer && t.status === "revision" && <><Button variant="brand" onClick={() => move("aprobado")}><Check />Aprobar</Button><Button variant="outline" onClick={askChanges}>Pedir correcciones</Button></>}
            {t.status === "aprobado" && <div className="flex w-full flex-wrap items-center gap-2"><Input className="min-w-40 flex-1" placeholder="Enlace de la publicación (opcional)" value={pubUrl} onChange={(e) => setPubUrl(e.target.value)} /><Button variant="brand" onClick={() => { if (move("publicado") && pubUrl.trim()) patch((x) => { x.result = { ...x.result, url: pubUrl.trim() }; }); }}>Marcar publicado</Button></div>}
            {t.changes && <Badge tone="warning">Correcciones pedidas</Badge>}{pending > 0 && <Badge tone="danger">{pending} obligatoria(s) pendiente(s)</Badge>}
            <Button variant="ghost" size="icon" aria-label="Borrar" className="ml-auto" onClick={() => setDel(true)}><Trash2 /></Button>
          </div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Historial ({t.history.length})</summary><ul className="mt-1 space-y-1">{[...t.history].reverse().map((h, i) => <li key={i}>{h.from ? `${COLUMNS.find((c) => c.id === h.from)?.label} → ` : "Creada en "}<b className="text-foreground">{COLUMNS.find((c) => c.id === h.to)?.label}</b> · {userName(s, h.byId)} · {fmtDateTime(h.at)}</li>)}</ul></details>
        </div>
        <ConfirmDialog open={del} onOpenChange={setDel} danger confirmLabel="Borrar" title="¿Borrar este video?" description="Se elimina con sus comentarios y feedback." onConfirm={() => { update((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); }, `Borró la tarea "${t.title}"`); onClose(); }} />
      </DialogContent>
    </Dialog>
  );
}

function Board() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const q = useSearchParams();
  const [open, setOpen] = useState(q.get("nueva") === "1");
  const [tab, setTab] = useState(q.get("tab") === "historial" ? "historial" : "tablero");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  useEffect(() => { if (q.get("nueva") === "1") router.replace("/videos"); }, [q, router]);
  if (!ready || !me) return <PageSkeleton />;
  const today = todayLima();
  const tasks = s.tasks;
  const sel = q.get("tarea");
  const onEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const r = moveTask(String(e.active.id), e.over.id as Column, me.id);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <>
      <PageHeader title="Mis videos" hint="Del guion a la publicación. Arrastra cada video; ábrelo para subir avances y recibir feedback."
        actions={<Button variant="brand" onClick={() => setOpen(true)}><Plus />Nuevo video</Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="tablero">Tablero ({tasks.filter((t) => t.status !== "publicado").length})</TabsTrigger><TabsTrigger value="historial">Historial ({tasks.filter((t) => t.status === "publicado").length})</TabsTrigger></TabsList></Tabs>
      {tab === "tablero" ? (
        <>
          {tasks.length === 0 && <Card className="mb-4 p-4 text-sm text-muted-foreground">Aún no hay videos. Crea uno o convierte una idea de <Link href="/ideas" className="text-primary underline">Ideas con IA</Link> en tarea.</Card>}
          <DndContext sensors={sensors} onDragEnd={onEnd}>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
              {COLUMNS.map((c) => <Col key={c.id} id={c.id} label={c.label} today={today} canDrag onOpen={(id) => router.push(`/videos?tarea=${id}`)} tasks={tasks.filter((t) => t.status === c.id)} />)}
            </div>
          </DndContext>
          <p className="text-xs text-muted-foreground">Solo el revisor aprueba. No se aprueba un video con correcciones obligatorias pendientes y solo se publica lo aprobado.</p>
        </>
      ) : <History />}
      <Sheet id={sel} onClose={() => router.replace("/videos")} />
      <TaskDialog open={open} onOpenChange={setOpen} go={false} />
    </>
  );
}

export default function VideosPage() { return <Suspense fallback={<PageSkeleton />}><Board /></Suspense>; }


function History() {
  const { s, ready } = useMe();
  const [tab, setTab] = useState("terminados");
  const [edit, setEdit] = useState<string | null>(null);
  if (!ready) return <PageSkeleton />;
  const today = todayLima();
  const done = s.tasks.filter((t) => t.status === "publicado").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const approved = s.tasks.filter((t) => t.status === "aprobado");
  const pending = s.tasks.filter((t) => t.status !== "publicado" && t.status !== "aprobado");
  const comp = compliance(s.tasks);
  const withRes = done.filter((t) => t.result && (t.result.views || t.result.messages || t.result.quotes));
  const sum = (k: "views" | "messages" | "quotes") => withRes.reduce((a, t) => a + (t.result?.[k] ?? 0), 0);
  const byPlatform = [...done.reduce((m, t) => m.set(t.platform ?? "Sin plataforma", (m.get(t.platform ?? "Sin plataforma") ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const setRes = (id: string, k: "views" | "messages" | "quotes" | "url", v: string) => update((x) => { const t = x.tasks.find((y) => y.id === id)!; t.result = { ...t.result, [k]: k === "url" ? v || undefined : v === "" ? undefined : Math.max(0, Number(v) || 0) }; });
  const rows = tab === "terminados" ? done : tab === "aprobados" ? approved : pending;

  return (
    <>
      <Stagger className="mb-5 grid gap-4 md:grid-cols-4">
        <Item><Card className="h-full p-5"><p className="text-xs text-muted-foreground">Videos publicados</p><p className="mt-2 text-3xl font-semibold tabular-nums"><CountUp value={done.length} /></p><p className="mt-1 text-xs text-muted-foreground">{approved.length} aprobados esperando publicar</p></Card></Item>
        <Item><Card className="h-full p-5"><p className="text-xs text-muted-foreground">Videos pendientes</p><p className="mt-2 text-3xl font-semibold tabular-nums"><CountUp value={pending.length} /></p><p className="mt-1 text-xs text-muted-foreground">{s.tasks.filter((t) => isOverdue(t, today)).length} con entrega atrasada</p></Card></Item>
        <Item className="md:col-span-2"><Card className="flex h-full items-center gap-5 p-5"><Ring pct={comp.pct ?? 0} size={84} stroke={8} tone="var(--success)"><b className="text-base tabular-nums">{comp.pct === null ? "—" : `${comp.pct}%`}</b></Ring><div><p className="text-sm font-semibold">Cumplimiento de entregas</p><p className="text-xs text-muted-foreground">{comp.delivered ? `${comp.onTime} de ${comp.delivered} videos llegaron a revisión a tiempo.` : "Aún no hay videos enviados a revisión con fecha de entrega."}</p></div></Card></Item>
      </Stagger>

      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="terminados">Terminados ({done.length})</TabsTrigger><TabsTrigger value="aprobados">Aprobados ({approved.length})</TabsTrigger><TabsTrigger value="pendientes">Pendientes ({pending.length})</TabsTrigger></TabsList></Tabs>
      {rows.length === 0 ? <EmptyState icon={HistoryIcon} title="Nada en esta lista" text={tab === "terminados" ? "Cuando publiques tu primer video aparecerá aquí." : "No hay videos en este estado."} /> : (
        <div className="space-y-2">
          {rows.map((t: Task) => (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${t.status === "publicado" ? "bg-success/15 text-success" : "bg-secondary text-secondary-foreground"}`}><CheckCircle2 className="size-5" /></span>
                <div className="min-w-0 flex-1"><Link href={`/videos?tarea=${t.id}`} className="font-medium hover:text-primary">{t.title}</Link><p className="text-xs text-muted-foreground">{[t.platform, t.status === "publicado" ? `publicado ${fmtDate(t.publishedAt)}` : t.due ? `entrega ${fmtDate(t.due)}` : undefined, t.deliveredAt && t.due ? (t.deliveredAt.slice(0, 10) <= t.due.slice(0, 10) ? "entregado a tiempo" : "entregado con retraso") : undefined].filter(Boolean).join(" · ")}</p></div>
                <Badge tone={t.status === "publicado" ? "success" : isOverdue(t, today) ? "danger" : "neutral"}>{COLUMNS.find((c) => c.id === t.status)?.label}</Badge>
                {t.status === "publicado" && <Button size="sm" variant="ghost" onClick={() => setEdit(edit === t.id ? null : t.id)}><Pencil />Resultados</Button>}
                {t.result?.url && <a href={t.result.url} target="_blank" rel="noreferrer" aria-label="Abrir publicación" className="text-muted-foreground hover:text-primary"><ExternalLink className="size-4" /></a>}
              </div>
              {t.status === "publicado" && (edit === t.id || t.result?.views || t.result?.messages || t.result?.quotes) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {edit === t.id ? (<>
                    {([["views", "Reproducciones"], ["messages", "Mensajes"], ["quotes", "Cotizaciones"]] as const).map(([k, l]) => <Field key={k} label={l}><Input type="number" min={0} value={t.result?.[k] ?? ""} onChange={(e) => setRes(t.id, k, e.target.value)} /></Field>)}
                    <Field label="Enlace"><Input value={t.result?.url ?? ""} onChange={(e) => setRes(t.id, "url", e.target.value)} placeholder="https://…" /></Field>
                  </>) : <p className="col-span-4 text-xs text-muted-foreground">{[t.result?.views !== undefined && `${NUM(t.result.views)} reproducciones`, t.result?.messages !== undefined && `${NUM(t.result.messages)} mensajes`, t.result?.quotes !== undefined && `${NUM(t.result.quotes)} cotizaciones`].filter(Boolean).join(" · ")} (registrados por ti)</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-2 text-sm font-semibold">Estadísticas de publicaciones</h2>
        {done.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay publicaciones registradas.</p> : (
          <div className="space-y-2 text-sm">
            <p>Por plataforma: {byPlatform.map(([p, n]) => <Badge key={p} className="mr-1.5">{p}: {n}</Badge>)}</p>
            {withRes.length ? <p>Con resultados registrados en {withRes.length} video(s): <b>{NUM(sum("views"))}</b> reproducciones · <b>{NUM(sum("messages"))}</b> mensajes · <b>{NUM(sum("quotes"))}</b> cotizaciones.</p> : <p className="text-muted-foreground">Sin cifras de rendimiento: agrégalas en “Resultados” de cada video publicado. No se estiman ni se inventan.</p>}
          </div>
        )}
      </Card>
    </>
  );
}
