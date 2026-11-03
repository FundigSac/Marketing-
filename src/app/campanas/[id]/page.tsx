"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Field, Input, Progress, Select, Textarea } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { MetricDialog } from "@/components/metric-form";
import { ratio, totals } from "@/lib/domain";
import { productName, update, useMe, userName } from "@/lib/store";
import { can, NETWORKS, type Campaign } from "@/lib/types";
import { fmtDate, NUM, PEN, uid } from "@/lib/utils";

const per = (a: number, b: number) => { const r = ratio(a, b); return r === null ? "—" : PEN(r); };
const pct = (a: number, b: number) => { const r = ratio(a, b); return r === null ? "—" : `${(r * 100).toFixed(1)}%`; };

export default function DetalleCampana() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, me, ready } = useMe();
  const [m, setM] = useState(false);
  const [del, setDel] = useState(false);
  const [post, setPost] = useState({ date: "", network: "Facebook", title: "", productId: "" });
  if (!ready || !me) return <PageSkeleton />;
  const c = s.campaigns.find((x) => x.id === id);
  if (!c) return <EmptyState icon={Megaphone} title="Campaña no encontrada" action={<Button asChild><Link href="/campanas">Volver</Link></Button>} />;
  const canWrite = can(me.role, "campaigns.write");
  const ms = s.metrics.filter((x) => x.campaignId === c.id).sort((a, b) => a.date.localeCompare(b.date));
  const t = totals(ms);
  const leads = s.leads.filter((l) => l.campaignId === c.id);
  const tasks = s.tasks.filter((x) => x.campaignId === c.id);
  const patch = (p: Partial<Campaign>) => update((st) => { Object.assign(st.campaigns.find((x) => x.id === c.id)!, p); });
  const days = [...new Set(ms.map((x) => x.date))];
  const chart = days.map((d) => ({ d: d.slice(5), Mensajes: ms.filter((x) => x.date === d).reduce((a, x) => a + x.messages, 0), Cotizaciones: ms.filter((x) => x.date === d).reduce((a, x) => a + x.quotes, 0), Gasto: ms.filter((x) => x.date === d).reduce((a, x) => a + x.spend, 0) }));

  return (
    <>
      <PageHeader eyebrow="Detalle de campaña" title={c.name} hint={c.objective}
        actions={<>{canWrite ? <Select aria-label="Estado" className="w-auto" value={c.status} onChange={(e) => patch({ status: e.target.value as Campaign["status"] })}><option value="propuesta">Propuesta</option><option value="activa">Activa</option><option value="terminada">Terminada</option><option value="cancelada">Cancelada</option></Select> : <Badge>{c.status}</Badge>}{can(me.role, "metrics.write") && <Button variant="brand" onClick={() => setM(true)}><Plus />Registrar resultados</Button>}{canWrite && <Button variant="outline" size="icon" aria-label="Borrar campaña" onClick={() => setDel(true)}><Trash2 /></Button>}</>} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {([["Gastado", PEN(t.spend)], ["Mensajes", NUM(t.messages)], ["Cotizaciones", NUM(t.quotes)], ["Ventas", NUM(t.sales)], ["Monto vendido", PEN(t.salesAmount)], ["Costo por cotización", per(t.spend, t.quotes)]] as const).map(([l, v]) => <Card key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></Card>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Resultados por día</CardTitle></CardHeader>
          <CardContent>{chart.length === 0 ? <EmptyState icon={Megaphone} title="Aún sin resultados" text="Registra la inversión y los resultados de cada día para ver el rendimiento." /> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke="var(--muted-foreground)" /><YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} /><Legend /><Bar dataKey="Mensajes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cotizaciones" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Datos de la campaña</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Presupuesto (S/)"><Input type="number" disabled={!canWrite} value={c.budget} onChange={(e) => patch({ budget: Number(e.target.value) || 0 })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Inicio"><Input type="date" disabled={!canWrite} value={c.start} onChange={(e) => patch({ start: e.target.value })} /></Field><Field label="Fin"><Input type="date" disabled={!canWrite} value={c.end} onChange={(e) => patch({ end: e.target.value })} /></Field></div>
            <Field label="Responsable"><Select disabled={!canWrite} value={c.ownerId ?? ""} onChange={(e) => patch({ ownerId: e.target.value || undefined })}><option value="">Sin asignar</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
            <Field label="Objetivo"><Textarea disabled={!canWrite} value={c.objective} onChange={(e) => patch({ objective: e.target.value })} /></Field>
            <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Presupuesto usado</span><b className="text-foreground">{pct(t.spend, c.budget)}</b></div><Progress value={c.budget ? (t.spend / c.budget) * 100 : 0} tone="brand" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Embudo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between"><span>Alcance</span><b>{NUM(t.reach)}</b></p><p className="flex justify-between"><span>Reproducciones</span><b>{NUM(t.views)}</b></p><p className="flex justify-between"><span>Interacciones</span><b>{NUM(t.interactions)}</b></p><p className="flex justify-between"><span>Clics</span><b>{NUM(t.clicks)}</b></p>
            <p className="flex justify-between"><span>Mensajes</span><b>{NUM(t.messages)}</b></p><p className="flex justify-between"><span>Cotizaciones</span><b>{NUM(t.quotes)}</b></p><p className="flex justify-between"><span>Ventas</span><b>{NUM(t.sales)}</b></p>
            <hr className="border-border" /><p className="flex justify-between text-muted-foreground"><span>Mensaje → cotización</span><b className="text-foreground">{pct(t.quotes, t.messages)}</b></p><p className="flex justify-between text-muted-foreground"><span>Cotización → venta</span><b className="text-foreground">{pct(t.sales, t.quotes)}</b></p><p className="flex justify-between text-muted-foreground"><span>Costo por mensaje</span><b className="text-foreground">{per(t.spend, t.messages)}</b></p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Publicaciones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {c.posts.length === 0 ? <p className="text-sm text-muted-foreground">Sin publicaciones registradas.</p> : <ul className="divide-y divide-border text-sm">{c.posts.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-2"><span><b>{p.title}</b> <span className="text-muted-foreground">· {p.network}{p.productId && ` · ${productName(s, p.productId)}`}</span></span><span className="flex items-center gap-2 text-xs text-muted-foreground">{fmtDate(p.date)}{canWrite && <button aria-label="Quitar" className="hover:text-destructive" onClick={() => patch({ posts: c.posts.filter((x) => x.id !== p.id) })}><Trash2 className="size-3.5" /></button>}</span></li>)}</ul>}
            {canWrite && <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"><Input placeholder="Título de la publicación" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} /><Input type="date" value={post.date} onChange={(e) => setPost({ ...post, date: e.target.value })} /><Select value={post.network} onChange={(e) => setPost({ ...post, network: e.target.value })}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}</Select><Select value={post.productId} onChange={(e) => setPost({ ...post, productId: e.target.value })}><option value="">Producto</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Button variant="outline" disabled={!post.title.trim() || !post.date} onClick={() => { patch({ posts: [...c.posts, { id: uid(), ...post, productId: post.productId || undefined }] }); setPost({ ...post, title: "" }); }}>Agregar</Button></div>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Seguimiento</CardTitle></CardHeader>
          <CardContent className="grid gap-6 text-sm md:grid-cols-2">
            <div><b>Consultas vinculadas ({leads.length})</b>{leads.length === 0 ? <p className="mt-1 text-muted-foreground">Ninguna. Vincúlalas en Consultas y cotizaciones.</p> : <ul className="mt-1 space-y-1">{leads.map((l) => <li key={l.id}>{l.contact} · <Badge>{l.stage}</Badge></li>)}</ul>}</div>
            <div><b>Tareas vinculadas ({tasks.length})</b>{tasks.length === 0 ? <p className="mt-1 text-muted-foreground">Ninguna.</p> : <ul className="mt-1 space-y-1">{tasks.map((x) => <li key={x.id}><Link className="hover:text-primary" href={`/produccion/tareas/${x.id}`}>{x.title}</Link> · {userName(s, x.assigneeId)}</li>)}</ul>}</div>
          </CardContent>
        </Card>
      </div>
      <MetricDialog open={m} onOpenChange={setM} campaignId={c.id} />
      <ConfirmDialog open={del} onOpenChange={setDel} danger confirmLabel="Borrar" title="¿Borrar la campaña?" description="Se borran también sus métricas."
        onConfirm={() => { update((st) => { st.campaigns = st.campaigns.filter((x) => x.id !== c.id); st.metrics = st.metrics.filter((x) => x.campaignId !== c.id); }, `Borró la campaña "${c.name}"`); toast.success("Campaña borrada"); router.push("/campanas"); }} />
    </>
  );
}
