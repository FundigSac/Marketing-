"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Plug, Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { MetricDialog } from "@/components/metric-form";
import { byProduct, ratio, totals } from "@/lib/domain";
import { COLUMNS, rowsToMetrics } from "@/lib/metrics-io";
import { update, useMe } from "@/lib/store";
import { can } from "@/lib/types";
import { download, fmtDate, NUM, PEN } from "@/lib/utils";

const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 } };
const INTEGRATIONS = ["Meta (Facebook / Instagram)", "TikTok Ads", "WhatsApp Business"];

export default function Resultados() {
  const { s, me, ready } = useMe();
  const [camp, setCamp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const ms = useMemo(() => (ready ? s.metrics.filter((m) => (!camp || m.campaignId === camp) && (!from || m.date >= from) && (!to || m.date <= to)).sort((a, b) => a.date.localeCompare(b.date)) : []), [s.metrics, ready, camp, from, to]);
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "metrics.write");
  const t = totals(ms);
  const days = [...new Set(ms.map((m) => m.date))];
  const daily = days.map((d) => { const x = ms.filter((m) => m.date === d); return { d: d.slice(5), Alcance: x.reduce((a, m) => a + m.reach, 0), Mensajes: x.reduce((a, m) => a + m.messages, 0), Cotizaciones: x.reduce((a, m) => a + m.quotes, 0), Gasto: x.reduce((a, m) => a + m.spend, 0) }; });
  const prods = byProduct(s, ms).filter((p) => p.t.messages + p.t.quotes + p.t.sales > 0).slice(0, 6).map((p) => ({ n: p.name, Mensajes: p.t.messages, Cotizaciones: p.t.quotes, Ventas: p.t.sales }));
  const kpis: [string, string][] = [["Personas alcanzadas", NUM(t.reach)], ["Reproducciones", NUM(t.views)], ["Interacciones", NUM(t.interactions)], ["Clics", NUM(t.clicks)], ["Mensajes", NUM(t.messages)], ["Cotizaciones", NUM(t.quotes)], ["Ventas", NUM(t.sales)], ["Inversión", PEN(t.spend)], ["Monto vendido", PEN(t.salesAmount)], ["Costo / cotización", ratio(t.spend, t.quotes) === null ? "—" : PEN(t.spend / t.quotes)]];

  const doImport = async (f: File) => {
    const defaultId = target || s.campaigns[0]?.id || "";
    try {
      let rows: unknown[][]; let source: "csv" | "excel" = "csv";
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readSheetFile } = await import("read-excel-file/browser");
        const sheets = await readSheetFile(f);
        rows = (sheets[0]?.data ?? []) as unknown[][]; source = "excel";
      } else rows = Papa.parse<string[]>(await f.text(), { skipEmptyLines: true }).data;
      const { out, errors } = rowsToMetrics(rows, s, defaultId, source);
      setErrs(errors);
      if (out.length) { update((st) => { st.metrics.push(...out); }, `Importó ${out.length} filas de métricas`); toast.success(`${out.length} filas importadas${errors.length ? ` · ${errors.length} con errores` : ""}`); }
      else toast.error("No se importó ninguna fila.");
    } catch { toast.error("No se pudo leer el archivo."); }
  };

  return (
    <>
      <PageHeader title="Panel de resultados" hint="Alcance, reproducciones, gasto, mensajes, cotizaciones y ventas: solo con datos que tú registras o importas."
        actions={canWrite ? <><Button variant="outline" onClick={() => download("plantilla-metricas.csv", "﻿" + COLUMNS.join(",") + "\n", "text/csv")}><Download />Plantilla</Button><Button variant="outline" onClick={() => file.current?.click()}><Upload />Importar CSV / Excel</Button><Button variant="brand" onClick={() => setOpen(true)}><Plus />Registrar</Button><input ref={file} type="file" accept=".csv,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} /></> : undefined} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select aria-label="Campaña" className="w-auto" value={camp} onChange={(e) => setCamp(e.target.value)}><option value="">Todas las campañas</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <label className="text-xs text-muted-foreground">Desde<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" /></label>
        <label className="text-xs text-muted-foreground">Hasta<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" /></label>
        {canWrite && <label className="text-xs text-muted-foreground">Campaña para importar<Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-auto"><option value="">Primera campaña</option>{s.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>}
      </div>
      {errs.length > 0 && <Card className="mb-4 border-destructive/40 p-4 text-sm" role="alert"><b className="text-destructive">Filas no importadas</b><ul className="mt-1 list-disc pl-5 text-xs">{errs.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul></Card>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{kpis.map(([l, v]) => <Card key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></Card>)}</div>
      {ms.length === 0 ? <EmptyState icon={Plug} title="Todavía no hay resultados" text="Registra el día a día de una campaña o importa un archivo con las columnas de la plantilla." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Alcance y gasto por día</CardTitle></CardHeader><CardContent><div className="h-60"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke="var(--muted-foreground)" /><YAxis fontSize={11} stroke="var(--muted-foreground)" /><Tooltip {...tip} /><Legend /><Area dataKey="Alcance" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} /><Area dataKey="Gasto" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.15} /></AreaChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Mensajes y cotizaciones por día</CardTitle></CardHeader><CardContent><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke="var(--muted-foreground)" /><YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><Tooltip {...tip} /><Legend /><Bar dataKey="Mensajes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cotizaciones" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>¿Qué productos generan más resultados?</CardTitle></CardHeader><CardContent>{prods.length === 0 ? <p className="text-sm text-muted-foreground">Asocia un producto a cada registro para ver este ranking.</p> : <div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={prods} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} /><XAxis type="number" fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><YAxis type="category" dataKey="n" fontSize={11} width={110} stroke="var(--muted-foreground)" /><Tooltip {...tip} /><Legend /><Bar dataKey="Mensajes" fill="var(--chart-1)" /><Bar dataKey="Cotizaciones" fill="var(--chart-4)" /><Bar dataKey="Ventas" fill="var(--chart-5)" /></BarChart></ResponsiveContainer></div>}</CardContent></Card>
          <Card className="overflow-x-auto lg:col-span-2"><CardHeader><CardTitle>Registros ({ms.length})</CardTitle></CardHeader><CardContent>
            <table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Fecha</th><th>Campaña</th><th>Red</th><th>Producto</th><th className="text-right">Gasto</th><th className="text-right">Alcance</th><th className="text-right">Msj</th><th className="text-right">Cotiz.</th><th className="text-right">Ventas</th><th>Origen</th><th /></tr></thead>
              <tbody>{[...ms].reverse().slice(0, 60).map((m) => <tr key={m.id} className="border-t border-border"><td className="py-2">{fmtDate(m.date)}</td><td>{s.campaigns.find((c) => c.id === m.campaignId)?.name}</td><td>{m.network}</td><td>{s.products.find((p) => p.id === m.productId)?.name ?? "—"}</td><td className="text-right tabular-nums">{PEN(m.spend)}</td><td className="text-right tabular-nums">{NUM(m.reach)}</td><td className="text-right tabular-nums">{NUM(m.messages)}</td><td className="text-right tabular-nums">{NUM(m.quotes)}</td><td className="text-right tabular-nums">{NUM(m.sales)}</td><td><Badge>{m.source}</Badge></td><td>{canWrite && <button aria-label="Borrar registro" className="text-muted-foreground hover:text-destructive" onClick={() => update((st) => { st.metrics = st.metrics.filter((x) => x.id !== m.id); })}><Trash2 className="size-4" /></button>}</td></tr>)}</tbody></table>
          </CardContent></Card>
        </div>
      )}
      <Card className="mt-4"><CardHeader><CardTitle>Integraciones con plataformas</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{INTEGRATIONS.map((n) => <div key={n} className="rounded-lg border border-dashed border-border p-4 text-sm"><b>{n}</b><p className="mt-1 text-xs text-muted-foreground">Requiere conexión (permisos y credenciales). No está conectada: por ahora carga los datos por CSV, Excel o a mano.</p><Badge tone="warning" className="mt-2">No conectada</Badge></div>)}</CardContent></Card>
      <MetricDialog open={open} onOpenChange={setOpen} campaignId={camp || undefined} />
    </>
  );
}
