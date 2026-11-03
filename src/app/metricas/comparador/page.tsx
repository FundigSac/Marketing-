"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GitCompare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Input, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { AiBox } from "@/components/ai-box";
import { ratio, totals } from "@/lib/domain";
import { useMe } from "@/lib/store";
import { NUM, PEN } from "@/lib/utils";

const pct = (a: number, b: number) => { const r = ratio(a, b); return r === null ? "—" : `${(r * 100).toFixed(1)}%`; };
const per = (a: number, b: number) => { const r = ratio(a, b); return r === null ? "—" : PEN(r); };

export default function Comparador() {
  const { s, ready } = useMe();
  const [mode, setMode] = useState("campanas");
  const [sel, setSel] = useState<string[]>([]);
  const [a, setA] = useState({ from: "", to: "" });
  const [b, setB] = useState({ from: "", to: "" });
  if (!ready) return <PageSkeleton />;

  const cols = mode === "campanas"
    ? s.campaigns.filter((c) => sel.includes(c.id)).map((c) => ({ key: c.id, name: c.name, sub: `${c.start} → ${c.end}`, budget: c.budget, posts: c.posts.length, t: totals(s.metrics.filter((m) => m.campaignId === c.id)) }))
    : [["Periodo A", a], ["Periodo B", b]].map(([name, r]) => { const rr = r as { from: string; to: string }; return { key: String(name), name: String(name), sub: rr.from && rr.to ? `${rr.from} → ${rr.to}` : "elige fechas", budget: 0, posts: 0, t: totals(s.metrics.filter((m) => (!rr.from || m.date >= rr.from) && (!rr.to || m.date <= rr.to))) }; });
  const rows: [string, (c: (typeof cols)[number]) => string][] = [
    ["Presupuesto", (c) => (c.budget ? PEN(c.budget) : "—")], ["Publicaciones", (c) => (mode === "campanas" ? String(c.posts) : "—")], ["Inversión", (c) => PEN(c.t.spend)], ["Alcance", (c) => NUM(c.t.reach)], ["Reproducciones", (c) => NUM(c.t.views)],
    ["Clics", (c) => NUM(c.t.clicks)], ["Mensajes", (c) => NUM(c.t.messages)], ["Cotizaciones", (c) => NUM(c.t.quotes)], ["Ventas", (c) => NUM(c.t.sales)], ["Monto vendido", (c) => PEN(c.t.salesAmount)],
    ["Costo por mensaje", (c) => per(c.t.spend, c.t.messages)], ["Costo por cotización", (c) => per(c.t.spend, c.t.quotes)], ["Mensaje → cotización", (c) => pct(c.t.quotes, c.t.messages)], ["Cotización → venta", (c) => pct(c.t.sales, c.t.quotes)],
  ];
  const chart = ["Mensajes", "Cotizaciones", "Ventas"].map((k) => ({ k, ...Object.fromEntries(cols.map((c) => [c.name, k === "Mensajes" ? c.t.messages : k === "Cotizaciones" ? c.t.quotes : c.t.sales])) }));
  const COLORS = ["var(--chart-1)", "var(--chart-4)", "var(--chart-5)", "var(--chart-3)"];

  return (
    <>
      <PageHeader title="Comparador de campañas" hint="Compara presupuestos, resultados y periodos lado a lado." />
      <Tabs value={mode} onValueChange={setMode} className="mb-4"><TabsList><TabsTrigger value="campanas">Entre campañas</TabsTrigger><TabsTrigger value="periodos">Entre periodos</TabsTrigger></TabsList></Tabs>
      {mode === "campanas" ? (
        <Card className="mb-4 p-4"><p className="mb-2 text-sm text-muted-foreground">Elige de 2 a 4 campañas:</p><div className="flex flex-wrap gap-2">{s.campaigns.map((c) => <button key={c.id} aria-pressed={sel.includes(c.id)} onClick={() => setSel((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id].slice(-4)))} className={`rounded-full border px-3 py-1.5 text-sm transition ${sel.includes(c.id) ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{c.name}</button>)}</div></Card>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">{([["Periodo A", a, setA], ["Periodo B", b, setB]] as const).map(([n, v, set]) => <Card key={n} className="flex items-end gap-3 p-4"><b className="w-24 text-sm">{n}</b><label className="text-xs text-muted-foreground">Desde<Input type="date" value={v.from} onChange={(e) => set({ ...v, from: e.target.value })} /></label><label className="text-xs text-muted-foreground">Hasta<Input type="date" value={v.to} onChange={(e) => set({ ...v, to: e.target.value })} /></label></Card>)}</div>
      )}
      {cols.length < 2 ? <EmptyState icon={GitCompare} title="Elige al menos dos para comparar" /> : (
        <div className="space-y-4">
          <Card className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">Indicador</th>{cols.map((c) => <th key={c.key} className="p-3">{c.name}<span className="block font-normal">{c.sub}</span></th>)}</tr></thead>
            <tbody>{rows.map(([l, f]) => <tr key={l} className="border-b border-border last:border-0"><td className="p-3 text-muted-foreground">{l}</td>{cols.map((c) => <td key={c.key} className="p-3 font-medium tabular-nums">{f(c)}</td>)}</tr>)}</tbody></table></Card>
          <AiBox title="Lectura de la comparación con IA" hint="Claude Haiku explica qué campaña o periodo rinde mejor y qué decidir." button="Analizar comparación" instruction={() => `Compara estos resultados reales y explica cuál rinde mejor, por qué y qué conviene hacer en la siguiente campaña: ${JSON.stringify(cols.map((c) => ({ nombre: c.name, periodo: c.sub, presupuesto: c.budget, ...c.t })))}`} />
          <Card><CardHeader><CardTitle>Embudo comparado</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="k" fontSize={12} stroke="var(--muted-foreground)" /><YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} /><Legend />{cols.map((c, i) => <Bar key={c.key} dataKey={c.name} fill={COLORS[i % 4]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></CardContent></Card>
        </div>
      )}
    </>
  );
}
