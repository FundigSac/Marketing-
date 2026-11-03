"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Film, Plus } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Input, Select, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { uploadFiles } from "@/lib/actions";
import { update, useMe, userName } from "@/lib/store";
import { can, NETWORKS, VIDEO_STATUS as STATUS } from "@/lib/types";
import { fmtDate, uid } from "@/lib/utils";

export default function VideosPendientes() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState("pend");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", platform: "TikTok", taskId: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ready || !me) return <PageSkeleton />;
  const canUpload = can(me.role, "files.write");
  const list = s.videos.filter((v) => (tab === "pend" ? v.status !== "aprobado" : tab === "ok" ? v.status === "aprobado" : true));

  const create = async () => {
    if (!file || !f.title.trim()) return;
    setBusy(true);
    const [saved] = await uploadFiles([file], me.id, { kind: "video" });
    const id = uid();
    update((st) => {
      st.videos.push({ id, title: f.title.trim(), platform: f.platform, taskId: f.taskId || undefined, versions: [{ v: 1, fileId: saved.id, at: new Date().toISOString(), byId: me.id }], notes: [], checklist: {}, status: "pendiente" });
      const t = st.tasks.find((x) => x.id === f.taskId);
      if (t && ["pendiente", "produccion"].includes(t.status)) { t.history.push({ at: new Date().toISOString(), byId: me.id, from: t.status, to: "entregado" }); t.status = "entregado"; }
    }, `Subió el video "${f.title.trim()}"`);
    setBusy(false); setOpen(false); toast.success("Video enviado a revisión"); router.push(`/produccion/videos/${id}`);
  };

  return (
    <>
      <PageHeader title="Videos por revisar" hint="Bandeja de videos enviados por marketing. Ábrelos para dejar observaciones por segundo."
        actions={canUpload ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Subir video</Button> : undefined} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="pend">Por revisar ({s.videos.filter((v) => v.status !== "aprobado").length})</TabsTrigger><TabsTrigger value="ok">Aprobados</TabsTrigger><TabsTrigger value="todos">Todos</TabsTrigger></TabsList></Tabs>
      {list.length === 0 ? <EmptyState icon={Film} title="No hay videos en esta bandeja" text="Sube el primer video para revisarlo con observaciones por segundo." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => { const [l, tone] = STATUS[v.status]; const pend = v.notes.filter((n) => !n.resolved).length; const t = s.tasks.find((x) => x.id === v.taskId); return (
            <Link key={v.id} href={`/produccion/videos/${v.id}`}><Card className="h-full space-y-2 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
              <div className="flex items-start justify-between gap-2"><b className="line-clamp-2">{v.title}</b><Badge tone={tone}>{l}</Badge></div>
              <p className="text-xs text-muted-foreground">{v.platform} · versión {v.versions.length} · subido {fmtDate(v.versions[v.versions.length - 1]?.at)}{t && ` · ${userName(s, t.assigneeId)}`}</p>
              <p className="text-sm">{pend > 0 ? <span className="text-warning">{pend} observación(es) pendiente(s)</span> : <span className="text-muted-foreground">{v.notes.length ? "Todas las observaciones corregidas" : "Sin observaciones"}</span>}</p>
            </Card></Link>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Subir video" description="El archivo se guarda en este navegador.">
        <div className="space-y-3">
          <Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Conexión HDPE · versión 1" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plataforma"><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}</Select></Field>
            <Field label="Tarea del Kanban"><Select value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}><option value="">Ninguna</option>{s.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
          </div>
          <Field label="Archivo de video"><Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create} disabled={!file || !f.title.trim() || busy}>{busy ? "Guardando…" : "Enviar a revisión"}</Button></div>
        </div>
      </DialogContent></Dialog>
    </>
  );
}
