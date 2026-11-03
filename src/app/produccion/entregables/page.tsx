"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackageCheck, Plus, Undo2 } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Input, Select, Tabs, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { moveTask, uploadFiles } from "@/lib/actions";
import { getFileBlob } from "@/lib/files";
import { update, useMe, userName } from "@/lib/store";
import { can, type Deliverable, type DeliverableKind } from "@/lib/types";
import { download, fmtDate, fmtDateTime, todayLima, uid } from "@/lib/utils";

const KINDS: Record<DeliverableKind, string> = { borrador: "Primer borrador", revision: "Revisión", correcciones: "Correcciones", final: "Entrega final", otro: "Otro" };

export default function Entregables() {
  const { s, me, ready } = useMe();
  const [tab, setTab] = useState("todos");
  const [open, setOpen] = useState(false);
  const [corr, setCorr] = useState<Deliverable | null>(null);
  const [corrText, setCorrText] = useState("");
  const [f, setF] = useState({ title: "", kind: "borrador" as DeliverableKind, assigneeId: "", dueAt: todayLima(), taskId: "" });
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "tasks.write");
  const today = todayLima();
  const status = (d: Deliverable) => (d.corrections ? "correccion" : d.receivedAt ? "recibido" : d.dueAt.slice(0, 10) < today ? "atrasado" : "pendiente");
  const list = [...s.deliverables].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).filter((d) => tab === "todos" || status(d) === tab);
  const LABEL = { pendiente: ["Pendiente", "primary"], atrasado: ["Atrasado", "danger"], recibido: ["Recibido", "success"], correccion: ["Con correcciones", "warning"] } as const;

  const create = () => {
    if (!f.title.trim()) return;
    update((st) => { st.deliverables.push({ id: uid(), title: f.title.trim(), kind: f.kind, assigneeId: f.assigneeId || undefined, dueAt: f.dueAt, taskId: f.taskId || undefined }); }, `Solicitó el entregable "${f.title.trim()}"`);
    setOpen(false); setF({ ...f, title: "" }); toast.success("Entregable solicitado");
  };
  const receive = async (d: Deliverable, files: FileList | null) => {
    let fileId: string | undefined;
    if (files?.length) fileId = (await uploadFiles(files, me.id))[0]?.id;
    update((st) => { const x = st.deliverables.find((y) => y.id === d.id)!; x.receivedAt = new Date().toISOString(); x.fileId = fileId ?? x.fileId; x.corrections = undefined; }, `Recibió el entregable "${d.title}"`);
    const t = s.tasks.find((x) => x.id === d.taskId);
    if (t && ["pendiente", "produccion"].includes(t.status)) moveTask(t.id, "entregado", me.id);
    toast.success("Entregable recibido");
  };

  return (
    <>
      <PageHeader title="Control de entregables" hint="Solicitudes, fechas acordadas, entregas recibidas y correcciones."
        actions={canWrite ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Solicitar entregable</Button> : undefined} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList>{[["todos", "Todos"], ["pendiente", "Pendientes"], ["atrasado", "Atrasados"], ["recibido", "Recibidos"], ["correccion", "Con correcciones"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs>
      {list.length === 0 ? <EmptyState icon={PackageCheck} title="Sin entregables" text="Solicita un entregable o genera el calendario semanal desde el Panel de Fabrizio." /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">Entregable</th><th>Tipo</th><th>Responsable</th><th>Fecha acordada</th><th>Estado</th><th className="pr-3 text-right">Acciones</th></tr></thead>
            <tbody>{list.map((d) => { const [l, tone] = LABEL[status(d)]; return (
              <tr key={d.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3"><b>{d.title}</b>{d.corrections && <p className="text-xs text-warning">Corrección: {d.corrections}</p>}{d.receivedAt && <p className="text-xs text-muted-foreground">Recibido {fmtDateTime(d.receivedAt)}</p>}</td>
                <td>{KINDS[d.kind]}</td><td>{userName(s, d.assigneeId)}</td><td>{fmtDate(d.dueAt)}</td><td><Badge tone={tone}>{l}</Badge></td>
                <td className="space-x-1 whitespace-nowrap pr-3 text-right">
                  {d.fileId && <Button size="sm" variant="ghost" onClick={async () => { const b = await getFileBlob(d.fileId!); b ? download("entregable", b) : toast.error("Archivo no disponible"); }}>Archivo</Button>}
                  {canWrite && !d.receivedAt && <label className="inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:brightness-110">Marcar recibido<input type="file" hidden onChange={(e) => receive(d, e.target.files)} /></label>}
                  {canWrite && d.receivedAt && !d.corrections && <Button size="sm" variant="outline" onClick={() => { setCorr(d); setCorrText(""); }}><Undo2 />Pedir corrección</Button>}
                  {canWrite && d.corrections && <Button size="sm" variant="outline" onClick={() => update((st) => { const x = st.deliverables.find((y) => y.id === d.id)!; x.corrections = undefined; })}>Corregido</Button>}
                </td>
              </tr>); })}</tbody>
          </table>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Solicitar entregable">
        <div className="space-y-3">
          <Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Primer borrador del video de codos" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DeliverableKind })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Fecha acordada"><Input type="date" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field>
            <Field label="Responsable"><Select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
            <Field label="Tarea (opcional)"><Select value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}><option value="">—</option>{s.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create} disabled={!f.title.trim()}>Solicitar</Button></div>
        </div>
      </DialogContent></Dialog>
      <Dialog open={!!corr} onOpenChange={(o) => !o && setCorr(null)}><DialogContent title="Pedir corrección" description={corr?.title}>
        <Field label="¿Qué debe corregir?"><Textarea value={corrText} onChange={(e) => setCorrText(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCorr(null)}>Cancelar</Button><Button disabled={!corrText.trim()} onClick={() => { update((st) => { st.deliverables.find((x) => x.id === corr!.id)!.corrections = corrText.trim(); }, `Pidió corrección en "${corr!.title}"`); const t = s.tasks.find((x) => x.id === corr!.taskId); if (t) moveTask(t.id, "cambios", me.id); setCorr(null); toast.success("Corrección solicitada"); }}>Enviar</Button></div>
      </DialogContent></Dialog>
    </>
  );
}
