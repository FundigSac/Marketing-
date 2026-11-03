"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ListChecks, Paperclip, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Field, Input, Progress, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { moveTask, uploadFiles } from "@/lib/actions";
import { isOverdue, STATUS_WEIGHT, taskProgress } from "@/lib/domain";
import { getFileBlob } from "@/lib/files";
import { update, useMe, userName } from "@/lib/store";
import { can, CONTENT_TYPES, TASK_COLUMNS, type Task, type TaskStatus } from "@/lib/types";
import { download, fmtDate, fmtDateTime, todayLima, uid } from "@/lib/utils";

export default function DetalleTarea() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, me, ready } = useMe();
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  const [del, setDel] = useState(false);
  if (!ready || !me) return <PageSkeleton />;
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return <EmptyState icon={ListChecks} title="Tarea no encontrada" action={<Button asChild><Link href="/produccion/kanban">Volver al Kanban</Link></Button>} />;

  const canWrite = can(me.role, "tasks.write");
  const patch = (p: Partial<Task>) => update((st) => { Object.assign(st.tasks.find((x) => x.id === t.id)!, p); });
  const video = s.videos.find((v) => v.taskId === t.id);
  const pendingNotes = video?.notes.filter((n) => n.mandatory && !n.resolved).length ?? 0;
  const deliverables = s.deliverables.filter((d) => d.taskId === t.id);
  const late = isOverdue(t, todayLima());

  const changeStatus = (to: TaskStatus) => {
    if (to === "aprobado" && pendingNotes > 0) { toast.error(`No se puede aprobar: hay ${pendingNotes} corrección(es) obligatoria(s) pendiente(s) en el video.`); return; }
    moveTask(t.id, to, me.id);
  };
  const addComment = () => { if (!comment.trim()) return; update((st) => { st.tasks.find((x) => x.id === t.id)!.comments.push({ id: uid(), byId: me.id, at: new Date().toISOString(), text: comment.trim() }); }); setComment(""); };
  const addItem = () => { if (!item.trim()) return; patch({ checklist: [...t.checklist, { id: uid(), text: item.trim(), done: false }] }); setItem(""); };
  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    const saved = await uploadFiles(files, me.id);
    patch({ attachments: [...t.attachments, ...saved.map((f) => ({ id: f.id, name: f.name }))] });
    toast.success("Archivo adjuntado");
  };

  return (
    <>
      <PageHeader eyebrow="Detalle de tarea" title={t.title} hint={t.description}
        actions={<><Badge tone={late ? "danger" : "primary"}>{TASK_COLUMNS.find((c) => c.id === t.status)?.label}{late && " · atrasada"}</Badge>{canWrite && <Button variant="outline" onClick={() => setDel(true)}><Trash2 />Borrar</Button>}</>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" className="sm:col-span-2"><Input value={t.title} disabled={!canWrite} onChange={(e) => patch({ title: e.target.value })} /></Field>
              <Field label="Descripción" className="sm:col-span-2"><Textarea value={t.description ?? ""} disabled={!canWrite} onChange={(e) => patch({ description: e.target.value })} /></Field>
              <Field label="Estado"><Select value={t.status} disabled={!canWrite} onChange={(e) => changeStatus(e.target.value as TaskStatus)}>{TASK_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
              <Field label="Responsable"><Select value={t.assigneeId ?? ""} disabled={!canWrite} onChange={(e) => patch({ assigneeId: e.target.value || undefined })}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
              <Field label="Fecha límite"><Input type="date" value={t.due?.slice(0, 10) ?? ""} disabled={!canWrite} onChange={(e) => patch({ due: e.target.value || undefined })} /></Field>
              <Field label="Prioridad"><Select value={t.priority} disabled={!canWrite} onChange={(e) => patch({ priority: e.target.value as Task["priority"] })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select></Field>
              <Field label="Producto"><Select value={t.productId ?? ""} disabled={!canWrite} onChange={(e) => patch({ productId: e.target.value || undefined })}><option value="">—</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Tipo de contenido"><Select value={t.contentType ?? ""} disabled={!canWrite} onChange={(e) => patch({ contentType: e.target.value || undefined })}><option value="">—</option>{CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lista de pasos</CardTitle><span className="text-xs text-muted-foreground">{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span></CardHeader>
            <CardContent className="space-y-2">
              {t.checklist.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.done} disabled={!canWrite} onChange={() => patch({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} /><span className={c.done ? "text-muted-foreground line-through" : ""}>{c.text}</span></label>)}
              {canWrite && <div className="flex gap-2 pt-1"><Input placeholder="Agregar paso…" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} /><Button variant="outline" onClick={addItem}>Agregar</Button></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Comentarios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {t.comments.length === 0 && <p className="text-sm text-muted-foreground">Sin comentarios.</p>}
              {t.comments.map((c) => <div key={c.id} className="rounded-md bg-muted p-3 text-sm"><b>{userName(s, c.byId)}</b> <span className="text-xs text-muted-foreground">{fmtDateTime(c.at)}</span><p className="mt-1 whitespace-pre-wrap">{c.text}</p></div>)}
              <div className="flex gap-2"><Input placeholder="Escribe un comentario…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} /><Button onClick={addComment} disabled={!comment.trim()}>Enviar</Button></div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Progreso</CardTitle><b className="text-lg">{taskProgress(t)}%</b></CardHeader>
            <CardContent className="space-y-2"><Progress value={taskProgress(t)} tone="brand" /><p className="text-xs text-muted-foreground">Criterio: el estado “{TASK_COLUMNS.find((c) => c.id === t.status)?.label}” aporta {STATUS_WEIGHT[t.status]}% del recorrido; los pasos completados de la lista ajustan el resto. No es una estimación manual.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="size-4" />Archivos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {t.attachments.map((a) => <button key={a.id} onClick={async () => { const b = await getFileBlob(a.id); b ? download(a.name, b) : toast.error("Archivo no disponible en este navegador"); }} className="block w-full truncate rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent">{a.name}</button>)}
              {canWrite && <label className="block cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground hover:bg-accent">Adjuntar archivo<input type="file" multiple hidden onChange={(e) => attach(e.target.files)} /></label>}
            </CardContent>
          </Card>
          {(video || deliverables.length > 0) && <Card><CardHeader><CardTitle>Relacionado</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
            {video && <Link href={`/produccion/videos/${video.id}`} className="block rounded-md border border-border p-3 hover:bg-accent">Video “{video.title}” · {video.status}{pendingNotes > 0 && <Badge tone="danger" className="ml-2">{pendingNotes} pendientes</Badge>}</Link>}
            {deliverables.map((d) => <Link key={d.id} href="/produccion/entregables" className="block rounded-md border border-border p-3 hover:bg-accent">{d.title} · {d.receivedAt ? "recibido" : `vence ${fmtDate(d.dueAt)}`}</Link>)}
          </CardContent></Card>}
          <Card>
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent><ol className="space-y-2 text-xs">{[...t.history].reverse().map((h, k) => <li key={k} className="flex justify-between gap-2"><span>{h.from ? `${TASK_COLUMNS.find((c) => c.id === h.from)?.label} → ` : "Creada en "}<b>{TASK_COLUMNS.find((c) => c.id === h.to)?.label}</b> · {userName(s, h.byId)}</span><span className="shrink-0 text-muted-foreground">{fmtDateTime(h.at)}</span></li>)}</ol></CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={del} onOpenChange={setDel} danger confirmLabel="Borrar" title="¿Borrar esta tarea?" description="Se elimina también su historial."
        onConfirm={() => { update((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); }, `Borró la tarea "${t.title}"`); router.push("/produccion/kanban"); }} />
    </>
  );
}
