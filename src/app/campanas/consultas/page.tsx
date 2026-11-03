"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Phone, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { productName, update, useMe } from "@/lib/store";
import { can, NETWORKS, type Lead, type LeadStage } from "@/lib/types";
import { fmtDate, PEN, todayLima, uid } from "@/lib/utils";

const STAGES: { id: LeadStage; label: string }[] = [{ id: "mensaje", label: "Mensaje recibido" }, { id: "cotizacion", label: "Cotización enviada" }, { id: "negociacion", label: "En negociación" }, { id: "venta", label: "Venta cerrada" }, { id: "perdida", label: "Perdida" }];

export default function Consultas() {
  const { s, me, ready } = useMe();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ contact: "", channel: "WhatsApp", productId: "", campaignId: "", amount: "", notes: "" });
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "leads.write");
  const primary = s.company.salesPhones.find((p) => p.primary && p.number);
  const total = s.leads.length;
  const count = (st: LeadStage) => s.leads.filter((l) => l.stage === st).length;
  const sold = s.leads.filter((l) => l.stage === "venta").reduce((a, l) => a + (l.amount ?? 0), 0);

  const add = () => {
    if (!f.contact.trim()) return;
    update((st) => { st.leads.unshift({ id: uid(), contact: f.contact.trim(), channel: f.channel, stage: "mensaje", date: todayLima(), productId: f.productId || undefined, campaignId: f.campaignId || undefined, amount: Number(f.amount) || undefined, notes: f.notes || undefined, history: [{ at: new Date().toISOString(), stage: "mensaje" }] }); }, "Registró una consulta");
    setOpen(false); setF({ ...f, contact: "", amount: "", notes: "" }); toast.success("Consulta registrada");
  };
  const move = (l: Lead, stage: LeadStage) => update((st) => { const x = st.leads.find((y) => y.id === l.id)!; x.stage = stage; x.history.push({ at: new Date().toISOString(), stage }); }, `Movió una consulta a "${stage}"`);

  return (
    <>
      <PageHeader title="Consultas y cotizaciones" hint="Del mensaje recibido a la cotización y la venta. Aquí se ve qué contenido realmente vende."
        actions={canWrite ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Nueva consulta</Button> : undefined} />
      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2"><Phone className="size-4 text-brand" />Contacto comercial principal:</span>
        {primary ? <b>{primary.label}: {primary.number}</b> : <span className="text-muted-foreground">Pendiente: Karla (termina en 664). Ingresa el número completo en <b>Equipo e integraciones</b>.</span>}
      </Card>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{STAGES.map((st) => <Card key={st.id} className="p-4"><p className="text-xs text-muted-foreground">{st.label}</p><p className="text-2xl font-semibold tabular-nums">{count(st.id)}</p>{total > 0 && <p className="text-xs text-muted-foreground">{Math.round((count(st.id) / total) * 100)}% del total</p>}</Card>)}</div>
      <p className="mb-4 text-sm text-muted-foreground">Ventas cerradas registradas: <b className="text-foreground">{PEN(sold)}</b></p>
      {s.leads.length === 0 ? <EmptyState icon={Inbox} title="Aún no hay consultas" text="Registra cada mensaje que llegue por WhatsApp, redes o llamada para medir qué convierte." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {s.leads.map((l) => (
            <Card key={l.id} className="space-y-2 p-4 text-sm">
              <div className="flex items-start justify-between gap-2"><b>{l.contact}</b><Badge tone={l.stage === "venta" ? "success" : l.stage === "perdida" ? "danger" : "primary"}>{STAGES.find((x) => x.id === l.stage)!.label}</Badge></div>
              <p className="text-xs text-muted-foreground">{l.channel} · {fmtDate(l.date)}{l.productId && ` · ${productName(s, l.productId)}`}{l.campaignId && ` · ${s.campaigns.find((c) => c.id === l.campaignId)?.name}`}</p>
              {l.notes && <p>{l.notes}</p>}
              {l.amount ? <p>Monto: <b>{PEN(l.amount)}</b></p> : null}
              {canWrite && <div className="flex items-center gap-2"><Select aria-label="Etapa" value={l.stage} onChange={(e) => move(l, e.target.value as LeadStage)}>{STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</Select><button aria-label="Borrar" className="text-muted-foreground hover:text-destructive" onClick={() => confirm("¿Borrar esta consulta?") && update((st) => { st.leads = st.leads.filter((x) => x.id !== l.id); })}><Trash2 className="size-4" /></button></div>}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Nueva consulta"><div className="space-y-3">
        <Field label="Contacto (nombre o empresa)"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Canal"><Select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}<option>Llamada</option></Select></Field>
          <Field label="Monto cotizado (S/)"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Producto"><Select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">—</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Campaña"><Select value={f.campaignId} onChange={(e) => setF({ ...f, campaignId: e.target.value })}><option value="">—</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        </div>
        <Field label="Notas"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={add} disabled={!f.contact.trim()}>Registrar</Button></div></div></DialogContent></Dialog>
    </>
  );
}
