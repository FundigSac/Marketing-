"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText, Printer, Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui/primitives";
import { Md, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { callAI } from "@/lib/ai-client";
import { byProduct, ratio, totals } from "@/lib/domain";
import { metricsToRows, toCSV } from "@/lib/metrics-io";
import { useMe } from "@/lib/store";
import { download, fmtDate, NUM, PEN, todayLima } from "@/lib/utils";

export default function Informes() {
  const { s, ready } = useMe();
  const [camp, setCamp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) return <PageSkeleton />;

  const ms = s.metrics.filter((m) => (!camp || m.campaignId === camp) && (!from || m.date >= from) && (!to || m.date <= to));
  const t = totals(ms);
  const prods = byProduct(s, ms).filter((p) => p.t.messages + p.t.quotes + p.t.sales > 0);
  const name = camp ? s.campaigns.find((c) => c.id === camp)?.name : "Todas las campañas";
  const facts: string[] = [];
  if (ms.length) {
    const cq = ratio(t.spend, t.quotes), cm = ratio(t.spend, t.messages);
    facts.push(`Se invirtieron ${PEN(t.spend)} y se registraron ${NUM(t.messages)} mensajes, ${NUM(t.quotes)} cotizaciones y ${NUM(t.sales)} ventas.`);
    if (cm !== null) facts.push(`Cada mensaje costó en promedio ${PEN(cm)}${cq !== null ? ` y cada cotización ${PEN(cq)}` : ""}.`);
    if (prods[0]) facts.push(`El producto con más cotizaciones/mensajes fue ${prods[0].name}.`);
    const net = new Map<string, number>(); ms.forEach((m) => net.set(m.network, (net.get(m.network) ?? 0) + m.messages));
    const best = [...net.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) facts.push(`La red con más mensajes fue ${best[0]} (${NUM(best[1])}).`);
  }

  const csv = () => { download(`informe-${todayLima()}.csv`, toCSV(metricsToRows(s, ms)), "text/csv"); };
  const xlsx = async () => {
    const { default: write } = await import("write-excel-file/browser");
    await write(metricsToRows(s, ms) as never).toFile(`informe-${todayLima()}.xlsx`);
  };
  const ask = async () => {
    setBusy(true);
    const r = await callAI<{ text: string }>(s, "summary", { instruction: `Analiza estos resultados reales de "${name}" y recomienda qué hacer en la siguiente campaña (qué producto, red y tipo de contenido priorizar, y qué datos faltan registrar). Datos: ${JSON.stringify({ totales: t, productos: prods.slice(0, 6).map((p) => ({ producto: p.name, ...p.t })) })}` });
    setBusy(false);
    if (r.ok) setAdvice(r.data.text); else toast.error(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY)." : r.error);
  };

  return (
    <>
      <PageHeader title="Centro de informes" hint="Reportes claros para decidir la siguiente campaña. Exporta a PDF, Excel o CSV."
        actions={<><Button variant="outline" onClick={csv} disabled={!ms.length}><FileText />CSV</Button><Button variant="outline" onClick={xlsx} disabled={!ms.length}><FileSpreadsheet />Excel</Button><Button variant="brand" onClick={() => window.print()} disabled={!ms.length}><Printer />PDF / Imprimir</Button></>} />
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Select aria-label="Campaña" className="w-auto" value={camp} onChange={(e) => setCamp(e.target.value)}><option value="">Todas las campañas</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <label className="text-xs text-muted-foreground">Desde<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" /></label>
        <label className="text-xs text-muted-foreground">Hasta<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" /></label>
      </div>
      <article className="space-y-4">
        <header className="hidden print:block"><h1 className="text-2xl font-semibold">FUNDIGSAC · Informe de marketing</h1><p className="text-sm">{name} · {from ? fmtDate(from) : "inicio"} – {to ? fmtDate(to) : "hoy"} · generado {fmtDate(todayLima())}</p></header>
        {ms.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No hay datos para este filtro. Registra o importa resultados en <b>Resultados</b>.</Card> : (
          <>
            <Card><CardHeader><CardTitle>Resumen ({name})</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{facts.map((f) => <li key={f}>{f}</li>)}</ul></CardContent></Card>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{([["Inversión", PEN(t.spend)], ["Mensajes", NUM(t.messages)], ["Cotizaciones", NUM(t.quotes)], ["Ventas", NUM(t.sales)], ["Monto vendido", PEN(t.salesAmount)]] as const).map(([l, v]) => <Card key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v}</p></Card>)}</div>
            <Card><CardHeader><CardTitle>Rendimiento por producto</CardTitle></CardHeader><CardContent>{prods.length === 0 ? <p className="text-sm text-muted-foreground">Asocia productos a los registros para ver este análisis.</p> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={prods.slice(0, 8).map((p) => ({ n: p.name, Mensajes: p.t.messages, Cotizaciones: p.t.quotes, Ventas: p.t.sales }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="n" fontSize={11} stroke="var(--muted-foreground)" /><YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} /><Legend /><Bar dataKey="Mensajes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cotizaciones" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /><Bar dataKey="Ventas" fill="var(--chart-5)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</CardContent></Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand" />Recomendación para la siguiente campaña</CardTitle><Button size="sm" variant="soft" className="no-print" onClick={ask} disabled={busy}>{busy ? "Analizando…" : advice ? "Actualizar" : "Pedir a la IA"}</Button></CardHeader>
              <CardContent>{advice ? <Md text={advice} /> : <p className="text-sm text-muted-foreground">Claude Haiku analiza solo los datos de este informe. La decisión final de inversión es humana.</p>}</CardContent>
            </Card>
          </>
        )}
      </article>
    </>
  );
}
