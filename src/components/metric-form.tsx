"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, Field, Input, Select } from "@/components/ui/primitives";
import { update, useStore } from "@/lib/store";
import { NETWORKS, type Metric } from "@/lib/types";
import { todayLima, uid } from "@/lib/utils";

const NUMS: [keyof Metric, string][] = [
  ["spend", "Gasto (S/)"], ["reach", "Personas alcanzadas"], ["views", "Reproducciones"], ["interactions", "Interacciones"],
  ["clicks", "Clics"], ["messages", "Mensajes recibidos"], ["quotes", "Cotizaciones solicitadas"], ["sales", "Ventas cerradas"], ["salesAmount", "Monto vendido (S/)"],
];

export function MetricDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (o: boolean) => void; campaignId?: string }) {
  const { s } = useStore();
  const [f, setF] = useState<Record<string, string>>({ date: todayLima(), network: "Facebook", campaignId: campaignId ?? "", productId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cid = campaignId ?? f.campaignId;

  const save = () => {
    if (!cid) { toast.error("Elige la campaña."); return; }
    const n = (k: string) => Math.max(0, Number(f[k]) || 0);
    const m: Metric = { id: uid(), campaignId: cid, date: f.date, productId: f.productId || undefined, network: f.network, spend: n("spend"), reach: n("reach"), views: n("views"), interactions: n("interactions"), clicks: n("clicks"), messages: n("messages"), quotes: n("quotes"), sales: n("sales"), salesAmount: n("salesAmount"), source: "manual" };
    update((st) => { st.metrics.push(m); }, "Registró métricas diarias");
    toast.success("Métricas guardadas");
    onOpenChange(false);
    setF((p) => ({ ...p, spend: "", reach: "", views: "", interactions: "", clicks: "", messages: "", quotes: "", sales: "", salesAmount: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Registrar resultados" description="Solo se guarda lo que escribes: nada se estima ni se inventa.">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {!campaignId && <Field label="Campaña" className="sm:col-span-2"><Select value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}><option value="">Elige…</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <Field label="Fecha"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Red"><Select value={f.network} onChange={(e) => set("network", e.target.value)}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}</Select></Field>
            <Field label="Producto" className="sm:col-span-2"><Select value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">Sin producto específico</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{NUMS.map(([k, l]) => <Field key={k} label={l}><Input type="number" min={0} step={k === "spend" || k === "salesAmount" ? "0.01" : "1"} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>)}</div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
