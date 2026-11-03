"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Plus } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Input, Progress, Select, Tabs, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { totals } from "@/lib/domain";
import { update, useMe, userName } from "@/lib/store";
import { can, type Campaign } from "@/lib/types";
import { fmtDate, NUM, PEN, todayLima, uid, addDays } from "@/lib/utils";

const ST: Record<Campaign["status"], [string, "primary" | "success" | "neutral" | "danger"]> = { propuesta: ["Propuesta", "primary"], activa: ["Activa", "success"], terminada: ["Terminada", "neutral"], cancelada: ["Cancelada", "danger"] };

export default function Campanas() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState("todas");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", objective: "", budget: "", start: todayLima(), days: "15", ownerId: "" });
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "campaigns.write");
  const list = s.campaigns.filter((c) => tab === "todas" || c.status === tab);

  const create = () => {
    if (!f.name.trim()) return;
    const id = uid();
    update((st) => { st.campaigns.push({ id, name: f.name.trim(), objective: f.objective, status: "propuesta", budget: Number(f.budget) || 0, start: f.start, end: addDays(f.start, Math.max(1, Number(f.days) || 15) - 1), ownerId: f.ownerId || undefined, posts: [] }); }, `Creó la campaña "${f.name.trim()}"`);
    toast.success("Campaña creada"); setOpen(false); router.push(`/campanas/${id}`);
  };

  return (
    <>
      <PageHeader title="Campañas publicitarias" hint="Activas, propuestas, terminadas y canceladas. La aprobación de gasto es siempre humana."
        actions={canWrite ? <Button variant="brand" onClick={() => setOpen(true)}><Plus />Nueva campaña</Button> : undefined} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList>{[["todas", "Todas"], ["activa", "Activas"], ["propuesta", "Propuestas"], ["terminada", "Terminadas"], ["cancelada", "Canceladas"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs>
      {list.length === 0 ? <EmptyState icon={Megaphone} title="No hay campañas en esta vista" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => { const t = totals(s.metrics.filter((m) => m.campaignId === c.id)); const [l, tone] = ST[c.status]; return (
            <Link key={c.id} href={`/campanas/${c.id}`}><Card className="h-full space-y-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
              <div className="flex items-start justify-between gap-2"><b className="leading-snug">{c.name}</b><Badge tone={tone}>{l}</Badge></div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{c.objective || "Sin objetivo definido"}</p>
              <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Gastado {PEN(t.spend)}</span><span>de {PEN(c.budget)}</span></div><Progress value={c.budget ? (t.spend / c.budget) * 100 : 0} tone={t.spend > c.budget ? "brand" : "primary"} /></div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs"><div><b className="block text-base">{NUM(t.messages)}</b>mensajes</div><div><b className="block text-base">{NUM(t.quotes)}</b>cotizaciones</div><div><b className="block text-base">{NUM(t.sales)}</b>ventas</div></div>
              <p className="text-xs text-muted-foreground">{fmtDate(c.start)} → {fmtDate(c.end)} · {userName(s, c.ownerId)}</p>
            </Card></Link>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Nueva campaña">
        <div className="space-y-3">
          <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Objetivo"><Textarea value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} placeholder="Ej. Generar consultas y cotizaciones de conexiones HDPE" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Presupuesto (S/)"><Input type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
            <Field label="Inicio"><Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
            <Field label="Duración (días)"><Input type="number" min={1} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
          </div>
          <Field label="Responsable"><Select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create} disabled={!f.name.trim()}>Crear</Button></div>
        </div>
      </DialogContent></Dialog>
    </>
  );
}
