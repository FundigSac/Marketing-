"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, Field, Input, Select } from "@/components/ui/primitives";
import { addTask } from "@/lib/actions";
import { useMe } from "@/lib/store";
import { PLATFORMS, type Task } from "@/lib/types";
import { addDays, todayLima } from "@/lib/utils";

export function TaskDialog({ open, onOpenChange, go = true }: { open: boolean; onOpenChange: (o: boolean) => void; go?: boolean }) {
  const { s, me } = useMe();
  const router = useRouter();
  const [f, setF] = useState({ title: "", due: addDays(todayLima(), 7), platform: "TikTok", productId: "", priority: "media" as Task["priority"] });
  if (!me) return null;
  const create = () => {
    if (f.title.trim().length < 3) return;
    addTask({ title: f.title.trim(), due: f.due || undefined, platform: f.platform, productId: f.productId || undefined, priority: f.priority }, me.id);
    toast.success("Video agregado a Producción");
    onOpenChange(false); setF({ ...f, title: "" });
    if (go) router.push("/videos");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nuevo video" description="Se agrega a “Por hacer” en Mis videos.">
        <div className="space-y-3">
          <Field label="¿Qué video vas a hacer?"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Ej. Codo HDPE de cerca" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de entrega"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
            <Field label="Plataforma"><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Field label="Producto"><Select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">—</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Prioridad"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Task["priority"] })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="brand" onClick={create} disabled={f.title.trim().length < 3}>Crear</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
