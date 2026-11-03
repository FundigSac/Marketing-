"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, FolderOpen, Image as ImageIcon, Trash2, Upload, Video } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { useFileUrl } from "@/components/use-file-url";
import { uploadFiles } from "@/lib/actions";
import { getFileBlob, removeFile } from "@/lib/files";
import { productName, update, useMe } from "@/lib/store";
import { can, type FileItem, type FileKind } from "@/lib/types";
import { download, fmtDate } from "@/lib/utils";

const KIND_LABEL: Record<FileKind, string> = { imagen: "Imagen", video: "Video", guion: "Guion", logo: "Logo", ficha: "Ficha técnica", otro: "Otro" };
const size = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

function Preview({ f }: { f: FileItem }) {
  const { url } = useFileUrl(f.mime.startsWith("image/") || f.mime.startsWith("video/") ? f.id : undefined);
  if (f.mime.startsWith("image/") && url) return <img src={url} alt={f.name} className="h-full w-full object-cover" />;
  if (f.mime.startsWith("video/") && url) return <video src={url} className="h-full w-full object-cover" muted />;
  const Icon = f.kind === "video" ? Video : f.kind === "imagen" || f.kind === "logo" ? ImageIcon : FileText;
  return <Icon className="size-8 text-muted-foreground" />;
}

export default function Biblioteca() {
  const { s, me, ready } = useMe();
  const [kind, setKind] = useState("");
  const [product, setProduct] = useState("");
  const [upProduct, setUpProduct] = useState("");
  const [del, setDel] = useState<FileItem | null>(null);
  const [view, setView] = useState<FileItem | null>(null);
  const { url: viewUrl } = useFileUrl(view?.id);
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "files.write");
  const files = s.files.filter((f) => (!kind || f.kind === kind) && (!product || f.productId === product));

  const up = async (list: FileList | null) => { if (!list?.length) return; const r = await uploadFiles(list, me.id, { productId: upProduct || undefined }); toast.success(`${r.length} archivo(s) guardado(s)`); };

  return (
    <>
      <PageHeader title="Biblioteca de contenidos" hint="Imágenes, videos, guiones, logos y fichas. Se guardan en este navegador; con Supabase Storage pasan a la nube."
        actions={canWrite ? <><Select aria-label="Producto del archivo" className="w-auto" value={upProduct} onChange={(e) => setUpProduct(e.target.value)}><option value="">Sin producto</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:brightness-105"><Upload className="size-4" />Subir archivos<input type="file" multiple hidden onChange={(e) => up(e.target.files)} /></label></> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Tipo" className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Producto" className="w-auto" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">Todos los productos</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>
      {files.length === 0 ? <EmptyState icon={FolderOpen} title="La biblioteca está vacía" text="Sube fotos reales de productos, logos, guiones y fichas para usarlos en tareas y videos." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((f) => (
            <Card key={f.id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
              <button className="grid aspect-video w-full place-items-center overflow-hidden bg-muted" onClick={() => setView(f)} aria-label={`Ver ${f.name}`}><Preview f={f} /></button>
              <div className="space-y-1 p-3 text-sm">
                <p className="truncate font-medium" title={f.name}>{f.name}</p>
                <p className="text-xs text-muted-foreground">{size(f.size)} · {fmtDate(f.addedAt)}{f.productId && ` · ${productName(s, f.productId)}`}</p>
                <div className="flex items-center justify-between pt-1"><Badge tone="primary">{KIND_LABEL[f.kind]}</Badge>
                  <span className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Descargar" onClick={async () => { const b = await getFileBlob(f.id); b ? download(f.name, b) : toast.error("Archivo no disponible"); }}><Download /></Button>{canWrite && <Button size="icon" variant="ghost" aria-label="Borrar" onClick={() => setDel(f)}><Trash2 /></Button>}</span></div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}><DialogContent title={view?.name ?? ""} className="max-w-3xl">
        {view && viewUrl && (view.mime.startsWith("video/") ? <video src={viewUrl} controls className="max-h-[70vh] w-full rounded-lg bg-black" /> : view.mime.startsWith("image/") ? <img src={viewUrl} alt={view.name} className="max-h-[70vh] w-full rounded-lg object-contain" /> : <p className="text-sm text-muted-foreground">Vista previa no disponible. Descarga el archivo para abrirlo.</p>)}
      </DialogContent></Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger confirmLabel="Borrar" title="¿Borrar este archivo?" description={del?.name} onConfirm={async () => { await removeFile(del!.id); update((st) => { st.files = st.files.filter((x) => x.id !== del!.id); }, `Borró el archivo "${del!.name}"`); toast.success("Archivo borrado"); }} />
    </>
  );
}
