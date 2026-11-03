"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes, ImagePlus, Plus, Star, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, ConfirmDialog, Dialog, DialogContent, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { useFileUrl } from "@/components/use-file-url";
import { uploadFiles } from "@/lib/actions";
import { update, useMe } from "@/lib/store";
import { can, type Product } from "@/lib/types";
import { uid } from "@/lib/utils";

const AV: Record<Product["availability"], [string, "success" | "danger" | "warning" | "neutral"]> = { disponible: ["Disponible", "success"], agotado: ["Agotado", "danger"], bajo_pedido: ["Bajo pedido", "warning"], sin_confirmar: ["Sin confirmar", "neutral"] };

function Photo({ id }: { id: string }) { const { url } = useFileUrl(id); return url ? <img src={url} alt="Foto del producto" className="size-16 rounded-md border border-border object-cover" /> : <div className="skeleton size-16" />; }

export default function Productos() {
  const { s, me, ready } = useMe();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("Conexiones HDPE");
  const [del, setDel] = useState<Product | null>(null);
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "products.write");
  const list = s.products.filter((p) => (!only || p.priority) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const patch = (id: string, p: Partial<Product>) => update((st) => { Object.assign(st.products.find((x) => x.id === id)!, p); });

  return (
    <>
      <PageHeader title="Productos prioritarios HDPE" hint="Qué queremos promocionar, disponibilidad, fotos y argumentos. La IA solo usa los datos que cargas aquí."
        actions={canWrite ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Agregar producto</Button> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-3"><Input className="max-w-xs" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />Solo prioritarios</label></div>
      {list.length === 0 ? <EmptyState icon={Boxes} title="Sin productos" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((p) => (
            <Card key={p.id}><CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div><b className="text-base">{p.name}</b><p className="text-xs text-muted-foreground">{p.category}{p.hdpe && " · HDPE"}</p></div>
                <div className="flex items-center gap-1.5"><Badge tone={AV[p.availability][1]}>{AV[p.availability][0]}</Badge>{canWrite && <button aria-label={p.priority ? "Quitar prioridad" : "Marcar prioritario"} aria-pressed={p.priority} onClick={() => patch(p.id, { priority: !p.priority })} className={`rounded-md p-1.5 transition ${p.priority ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}><Star className={`size-5 ${p.priority ? "fill-current" : ""}`} /></button>}{canWrite && <button aria-label="Borrar" onClick={() => setDel(p)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Disponibilidad"><Select disabled={!canWrite} value={p.availability} onChange={(e) => patch(p.id, { availability: e.target.value as Product["availability"] })}>{Object.entries(AV).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</Select></Field>
                <Field label="Categoría"><Input disabled={!canWrite} value={p.category} onChange={(e) => patch(p.id, { category: e.target.value })} /></Field>
              </div>
              <Field label="Especificaciones verificadas" hint="Escribe solo medidas y datos confirmados. Si está vacío, la IA dirá “por confirmar”."><Textarea disabled={!canWrite} value={p.specs} onChange={(e) => patch(p.id, { specs: e.target.value })} /></Field>
              <Field label="Argumento comercial"><Textarea disabled={!canWrite} value={p.pitch} onChange={(e) => patch(p.id, { pitch: e.target.value })} /></Field>
              <div className="flex flex-wrap items-center gap-2">{p.photoFileIds.map((id) => <Photo key={id} id={id} />)}{canWrite && <label className="grid size-16 cursor-pointer place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-accent" aria-label="Subir fotos"><ImagePlus className="size-5" /><input type="file" accept="image/*" multiple hidden onChange={async (e) => { if (!e.target.files?.length) return; const f = await uploadFiles(e.target.files, me.id, { kind: "imagen", productId: p.id }); patch(p.id, { photoFileIds: [...p.photoFileIds, ...f.map((x) => x.id)] }); toast.success("Fotos agregadas"); }} /></label>}{p.photoFileIds.length === 0 && <span className="text-xs text-muted-foreground">Sube fotos reales del producto.</span>}</div>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Agregar producto"><div className="space-y-3"><Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Categoría"><Input value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!name.trim()} onClick={() => { update((st) => { st.products.push({ id: uid(), name: name.trim(), category: cat, hdpe: /hdpe/i.test(name + cat), priority: true, availability: "sin_confirmar", specs: "", pitch: "", photoFileIds: [] }); }, `Agregó el producto "${name.trim()}"`); setName(""); setOpen(false); }}>Agregar</Button></div></div></DialogContent></Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger confirmLabel="Borrar" title="¿Borrar este producto?" description={del?.name} onConfirm={() => update((st) => { st.products = st.products.filter((x) => x.id !== del!.id); }, `Borró el producto "${del!.name}"`)} />
    </>
  );
}
