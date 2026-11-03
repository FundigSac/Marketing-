"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Camera, Check, ImagePlus, Film, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { useFileUrl } from "@/components/use-file-url";
import { moveTask, uploadFiles } from "@/lib/actions";
import { putFile } from "@/lib/files";
import { update, useMe, userName } from "@/lib/store";
import { can, VIDEO_CHECKLIST, VIDEO_STATUS, type VideoReview } from "@/lib/types";
import { fmtDateTime, mmss, uid } from "@/lib/utils";

function Shot({ id }: { id: string }) {
  const { url } = useFileUrl(id);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Captura adjunta" className="mt-2 h-20 rounded-md border border-border object-cover" /></a> : null;
}

export default function RevisionVideo() {
  const { id } = useParams<{ id: string }>();
  const { s, me, ready } = useMe();
  const vref = useRef<HTMLVideoElement>(null);
  const [ver, setVer] = useState(0);
  const [text, setText] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [shot, setShot] = useState<string | undefined>();
  const [time, setTime] = useState(0);
  const v = s.videos?.find((x) => x.id === id);
  const current = v ? v.versions.find((x) => x.v === (ver || v.versions.length)) ?? v.versions[v.versions.length - 1] : undefined;
  const { url, loading } = useFileUrl(current?.fileId);
  if (!ready || !me) return <PageSkeleton />;
  if (!v || !current) return <EmptyState icon={Film} title="Video no encontrado" action={<Button asChild><Link href="/produccion/videos">Volver a la bandeja</Link></Button>} />;

  const canReview = can(me.role, "tasks.review");
  const canFix = can(me.role, "tasks.write") || canReview;
  const patch = (fn: (x: VideoReview) => void, log?: string) => update((st) => { fn(st.videos.find((y) => y.id === v.id)!); }, log);
  const pending = v.notes.filter((n) => n.mandatory && !n.resolved);
  const checkedAll = VIDEO_CHECKLIST.every((c) => v.checklist[c]);
  const [label, tone] = VIDEO_STATUS[v.status];
  const dur = vref.current?.duration || 0;

  const capture = async () => {
    const el = vref.current; if (!el || !el.videoWidth) { toast.error("Reproduce el video para capturar un cuadro."); return; }
    const c = document.createElement("canvas"); c.width = Math.min(960, el.videoWidth); c.height = Math.round((c.width / el.videoWidth) * el.videoHeight);
    c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
    if (!blob) return;
    const sid = uid(); await putFile(sid, blob); setShot(sid); toast.success("Cuadro capturado");
  };
  const attachImg = async (files: FileList | null) => { if (!files?.length) return; const [f] = await uploadFiles(files, me.id, { kind: "imagen" }); setShot(f.id); };

  const addNote = () => {
    if (!text.trim()) return;
    const at = Math.round((vref.current?.currentTime ?? time) * 10) / 10;
    patch((x) => { x.notes.push({ id: uid(), at, text: text.trim(), mandatory, resolved: false, shot, byId: me.id, version: current.v, createdAt: new Date().toISOString() }); x.notes.sort((a, b) => a.at - b.at); if (x.status === "pendiente") x.status = "en_revision"; }, `Dejó una observación en ${mmss(at)} de "${v.title}"`);
    setText(""); setShot(undefined);
  };
  const requestChanges = () => {
    patch((x) => { x.status = "cambios"; }, `Solicitó cambios en "${v.title}"`);
    if (v.taskId) moveTask(v.taskId, "cambios", me.id);
    toast.success("Cambios solicitados al equipo");
  };
  const approve = () => {
    if (pending.length) { toast.error(`Hay ${pending.length} corrección(es) obligatoria(s) pendiente(s).`); return; }
    if (!checkedAll) { toast.error("Completa la lista de comprobación."); return; }
    patch((x) => { x.status = "aprobado"; x.approvedById = me.id; x.approvedAt = new Date().toISOString(); }, `Aprobó el video "${v.title}"`);
    if (v.taskId) moveTask(v.taskId, "aprobado", me.id);
    toast.success("Video aprobado");
  };
  const newVersion = async (files: FileList | null) => {
    if (!files?.length) return;
    const [f] = await uploadFiles([files[0]], me.id, { kind: "video" });
    patch((x) => { x.versions.push({ v: x.versions.length + 1, fileId: f.id, at: new Date().toISOString(), byId: me.id }); x.status = "pendiente"; x.approvedAt = undefined; x.approvedById = undefined; }, `Subió una nueva versión de "${v.title}"`);
    setVer(0);
    if (v.taskId) moveTask(v.taskId, "revision", me.id);
    toast.success("Nueva versión enviada a revisión");
  };

  return (
    <>
      <PageHeader eyebrow="Revisión y aprobación" title={v.title} hint={`${v.platform} · versión ${current.v} de ${v.versions.length}`}
        actions={<><Badge tone={tone}>{label}</Badge>{v.versions.length > 1 && <Select aria-label="Versión" className="w-auto" value={current.v} onChange={(e) => setVer(Number(e.target.value))}>{v.versions.map((x) => <option key={x.v} value={x.v}>Versión {x.v}</option>)}</Select>}</>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            {loading ? <div className="skeleton aspect-video" /> : url ? <video ref={vref} src={url} controls className="max-h-[62vh] w-full bg-black" onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} /> : <div className="grid aspect-video place-items-center p-6 text-center text-sm text-muted-foreground">El archivo de esta versión no está en este navegador.</div>}
            <div className="relative mx-4 mb-1 mt-3 h-2 rounded-full bg-muted" aria-hidden>
              {dur > 0 && v.notes.filter((n) => n.version === current.v).map((n) => <button key={n.id} tabIndex={-1} onClick={() => vref.current && (vref.current.currentTime = n.at)} className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${n.resolved ? "bg-success" : n.mandatory ? "bg-destructive" : "bg-brand"}`} style={{ left: `${(n.at / dur) * 100}%` }} />)}
            </div>
            <p className="px-4 pb-3 text-xs text-muted-foreground">Rojo: obligatoria pendiente · Naranja: sugerencia · Verde: corregida</p>
          </Card>
          {canReview && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between"><b className="text-sm">Nueva observación en {mmss(time)}</b><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />Corrección obligatoria</label></div>
              <div className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Ej. La imagen del producto necesita verse más real" /><Button onClick={addNote} disabled={!text.trim()}>Anotar</Button></div>
              <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={capture}><Camera />Capturar cuadro</Button><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-xs font-medium hover:bg-accent"><ImagePlus className="size-4" />Adjuntar imagen<input type="file" accept="image/*" hidden onChange={(e) => attachImg(e.target.files)} /></label>{shot && <Badge tone="success">Captura lista para adjuntar</Badge>}</div>
            </Card>
          )}
          <Card className="flex items-start gap-3 p-4 text-sm"><Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><p className="text-muted-foreground"><b className="text-foreground">Análisis automático:</b> no hay herramienta de análisis multimedia configurada. La IA <u>no</u> ha revisado este archivo; la revisión es solo humana.</p></Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Observaciones ({v.notes.length})</CardTitle><span className="text-xs text-muted-foreground">{pending.length} obligatorias pendientes</span></CardHeader>
            <CardContent>
              {v.notes.length === 0 ? <p className="text-sm text-muted-foreground">Sin observaciones.</p> : (
                <ul className="divide-y divide-border">{v.notes.map((n) => (
                  <li key={n.id} className="flex gap-2.5 py-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={n.resolved} disabled={!canFix} aria-label="Marcar como corregida" onChange={() => patch((x) => { const y = x.notes.find((z) => z.id === n.id)!; y.resolved = !y.resolved; }, `${n.resolved ? "Reabrió" : "Marcó como corregida"} una observación de "${v.title}"`)} />
                    <div className="min-w-0 flex-1">
                      <p><button onClick={() => { const el = vref.current; if (el) { el.currentTime = n.at; el.pause(); } }} className="font-mono font-semibold text-primary hover:underline">{mmss(n.at)}</button> <span className={n.resolved ? "text-muted-foreground line-through" : ""}>{n.text}</span></p>
                      <p className="text-xs text-muted-foreground">v{n.version} · {userName(s, n.byId)} · {fmtDateTime(n.createdAt)} {n.mandatory ? <Badge tone={n.resolved ? "success" : "danger"}>{n.resolved ? "corregida" : "obligatoria"}</Badge> : <Badge>sugerencia</Badge>}</p>
                      {n.shot && <Shot id={n.shot} />}
                    </div>
                  </li>
                ))}</ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lista de comprobación</CardTitle><span className="text-xs text-muted-foreground">{VIDEO_CHECKLIST.filter((c) => v.checklist[c]).length}/{VIDEO_CHECKLIST.length}</span></CardHeader>
            <CardContent className="space-y-2">
              {VIDEO_CHECKLIST.map((c) => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canReview} checked={!!v.checklist[c]} onChange={() => patch((x) => { x.checklist[c] = !x.checklist[c]; })} />{c}</label>)}
              <div className="flex flex-wrap gap-2 pt-3">
                {canReview && <Button variant="brand" onClick={approve} disabled={v.status === "aprobado"}><Check />{v.status === "aprobado" ? "Aprobado" : "Aprobar video"}</Button>}
                {canReview && v.status !== "aprobado" && <Button variant="outline" onClick={requestChanges}>Solicitar cambios</Button>}
                {can(me.role, "files.write") && <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"><Upload className="size-4" />Subir nueva versión<input type="file" accept="video/*" hidden onChange={(e) => newVersion(e.target.files)} /></label>}
              </div>
              {v.status !== "aprobado" && (pending.length > 0 || !checkedAll) && <p className="text-xs text-muted-foreground">Para aprobar: resuelve {pending.length ? `${pending.length} corrección(es) obligatoria(s)` : "las correcciones"} y marca toda la lista.</p>}
              {v.approvedAt && <p className="text-xs text-success">Aprobado por {userName(s, v.approvedById)} · {fmtDateTime(v.approvedAt)}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
