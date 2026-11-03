"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { project, ratio, totals, type Scenario } from "@/lib/domain";
import { useMe } from "@/lib/store";
import { NUM, PEN } from "@/lib/utils";

// Supuestos orientativos y editables. NO son datos de FUNDIGSAC ni garantías.
const DEFAULTS: Scenario[] = [
  { name: "Conservador", cpm: 15, ctr: 0.006, msgRate: 0.03, quoteRate: 0.2, closeRate: 0.05, ticket: 0 },
  { name: "Base", cpm: 10, ctr: 0.01, msgRate: 0.06, quoteRate: 0.3, closeRate: 0.1, ticket: 0 },
  { name: "Optimista", cpm: 7, ctr: 0.015, msgRate: 0.1, quoteRate: 0.4, closeRate: 0.15, ticket: 0 },
];
const MIN_DAYS = 5, MIN_SPEND = 50;

export default function Simulador() {
  const { s, ready } = useMe();
  const [budget, setBudget] = useState(275);
  const [days, setDays] = useState(15);
  const [ticket, setTicket] = useState(0);
  const [sc, setSc] = useState<Scenario[]>(DEFAULTS);
  const [campaignId, setCampaignId] = useState("todas");
  if (!ready) return <PageSkeleton />;

  const ms = s.metrics.filter((m) => campaignId === "todas" || m.campaignId === campaignId);
  const t = totals(ms);
  const dayCount = new Set(ms.filter((m) => m.spend > 0).map((m) => m.date)).size;
  const enough = dayCount >= MIN_DAYS && t.spend >= MIN_SPEND && t.messages > 0;
  const cpMsg = ratio(t.spend, t.messages), qRate = ratio(t.quotes, t.messages), cRate = ratio(t.sales, t.quotes);
  const real = enough && cpMsg ? { messages: budget / cpMsg, quotes: (budget / cpMsg) * (qRate ?? 0), sales: (budget / cpMsg) * (qRate ?? 0) * (cRate ?? 0) } : null;
  const edit = (i: number, k: keyof Scenario, v: number) => setSc((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <>
      <PageHeader title="Simulador de presupuesto" hint="Proyecciones basadas en tus datos reales cuando existen; si no, escenarios orientativos con supuestos claros." />
      <Card className="mb-4 flex items-start gap-3 border-brand/40 bg-brand/5 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-brand" /><p><b>Son estimaciones, no garantías.</b> Los resultados reales dependen del anuncio, el público, la competencia y la temporada.</p></Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Presupuesto total (S/)" hint="Escenario inicial: S/250–S/300"><Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} /></Field>
            <Field label="Duración (días)"><Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} /></Field>
            <Field label="Ticket promedio de venta (S/, opcional)" hint="Sin este dato no se proyectan ingresos."><Input type="number" min={0} value={ticket || ""} onChange={(e) => setTicket(Number(e.target.value) || 0)} /></Field>
            <Field label="Datos históricos de"><Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="todas">Todas las campañas</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <p className="text-sm">Gasto diario sugerido: <b>{PEN(budget / Math.max(1, days))}</b></p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Proyección con datos reales</CardTitle>{real ? <Badge tone="success">Basada en tus resultados</Badge> : <Badge tone="warning">Faltan datos</Badge>}</CardHeader>
          <CardContent>
            {real ? (
              <div className="space-y-3"><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg bg-muted p-4"><b className="block text-2xl">{NUM(Math.round(real.messages))}</b><span className="text-xs text-muted-foreground">mensajes</span></div><div className="rounded-lg bg-muted p-4"><b className="block text-2xl">{NUM(Math.round(real.quotes))}</b><span className="text-xs text-muted-foreground">cotizaciones</span></div><div className="rounded-lg bg-muted p-4"><b className="block text-2xl">{real.sales.toFixed(1)}</b><span className="text-xs text-muted-foreground">ventas</span></div></div>
              <p className="text-xs text-muted-foreground">Si el rendimiento se mantuviera igual al histórico ({dayCount} días, {PEN(t.spend)} gastados): {PEN(cpMsg!)} por mensaje, {((qRate ?? 0) * 100).toFixed(0)}% de mensajes llegan a cotización, {((cRate ?? 0) * 100).toFixed(0)}% de cotizaciones se venden.{ticket > 0 && ` Ingresos estimados: ${PEN(real.sales * ticket)}.`}</p></div>
            ) : <p className="text-sm text-muted-foreground">Para proyectar con tu rendimiento real se necesitan al menos {MIN_DAYS} días con gasto y {PEN(MIN_SPEND)} invertidos, con mensajes registrados. Tienes {dayCount} día(s) y {PEN(t.spend)}. Registra o importa métricas en <b>Resultados</b>. Mientras tanto, mira los escenarios orientativos.</p>}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:col-span-3 md:grid-cols-3">
          {sc.map((x, i) => { const p = project(budget, { ...x, ticket }); return (
            <Card key={x.name}>
              <CardHeader><CardTitle>Escenario {x.name.toLowerCase()}</CardTitle><Badge tone="neutral">orientativo</Badge></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center"><div><b className="block text-xl">{NUM(Math.round(p.messages))}</b><span className="text-[11px] text-muted-foreground">mensajes</span></div><div><b className="block text-xl">{NUM(Math.round(p.quotes))}</b><span className="text-[11px] text-muted-foreground">cotiz.</span></div><div><b className="block text-xl">{p.sales.toFixed(1)}</b><span className="text-[11px] text-muted-foreground">ventas</span></div></div>
                {ticket > 0 && <p className="text-center text-sm">Ingresos: <b>{PEN(p.revenue)}</b></p>}
                <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Supuestos (editables)</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">{([["cpm", "CPM (S/ por 1000)", 1], ["ctr", "CTR %", 100], ["msgRate", "Clic → mensaje %", 100], ["quoteRate", "Mensaje → cotiz. %", 100], ["closeRate", "Cotiz. → venta %", 100]] as const).map(([k, l, m]) => <Field key={k} label={l}><Input type="number" step="0.1" value={+(x[k] * m).toFixed(2)} onChange={(e) => edit(i, k, (Number(e.target.value) || 0) / m)} /></Field>)}</div></details>
              </CardContent>
            </Card>
          ); })}
        </div>
      </div>
    </>
  );
}
