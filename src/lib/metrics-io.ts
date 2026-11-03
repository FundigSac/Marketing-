import type { Metric, State } from "./types";
import { uid } from "./utils";

export const COLUMNS = ["fecha", "campana", "red", "producto", "gasto", "alcance", "reproducciones", "interacciones", "clics", "mensajes", "cotizaciones", "ventas", "monto_vendido"] as const;

const norm = (x: unknown) => String(x ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");
const num = (x: unknown) => { const n = Number(String(x ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.max(0, n) : 0; };

function toISO(x: unknown): string | null {
  if (x instanceof Date) return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const t = String(x ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // formato peruano dd/mm/aaaa
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Convierte filas (CSV o Excel, con encabezados) en métricas. Devuelve errores por fila; no inventa datos. */
export function rowsToMetrics(rows: unknown[][], s: State, defaultCampaignId: string, source: Metric["source"]) {
  const errors: string[] = [], out: Metric[] = [];
  if (rows.length < 2) return { out, errors: ["El archivo no tiene filas de datos."] };
  const head = rows[0].map(norm);
  const col = (n: string, alts: string[] = []) => head.findIndex((h) => h === n || alts.includes(h));
  const idx = { date: col("fecha"), camp: col("campana", ["campaña", "campaign"]), net: col("red", ["red_social", "plataforma"]), prod: col("producto"), spend: col("gasto", ["inversion"]), reach: col("alcance"), views: col("reproducciones", ["vistas"]), inter: col("interacciones"), clicks: col("clics", ["clicks"]), msgs: col("mensajes"), quotes: col("cotizaciones"), sales: col("ventas"), amount: col("monto_vendido", ["monto", "ingresos"]) };
  if (idx.date < 0) return { out, errors: ['Falta la columna "fecha".'] };
  rows.slice(1).forEach((r, i) => {
    if (r.every((c) => c === "" || c == null)) return;
    const line = i + 2;
    const date = toISO(r[idx.date]);
    if (!date) { errors.push(`Fila ${line}: fecha inválida (usa aaaa-mm-dd o dd/mm/aaaa).`); return; }
    const cname = idx.camp >= 0 ? String(r[idx.camp] ?? "").trim().toLowerCase() : "";
    const campaign = cname ? s.campaigns.find((c) => c.name.toLowerCase() === cname) : s.campaigns.find((c) => c.id === defaultCampaignId);
    if (!campaign) { errors.push(`Fila ${line}: la campaña "${r[idx.camp]}" no existe.`); return; }
    const pname = idx.prod >= 0 ? String(r[idx.prod] ?? "").trim().toLowerCase() : "";
    const g = (i2: number) => (i2 >= 0 ? num(r[i2]) : 0);
    out.push({ id: uid(), campaignId: campaign.id, date, network: idx.net >= 0 ? String(r[idx.net] || "Otra") : "Otra", productId: pname ? s.products.find((p) => p.name.toLowerCase() === pname)?.id : undefined, spend: g(idx.spend), reach: g(idx.reach), views: g(idx.views), interactions: g(idx.inter), clicks: g(idx.clicks), messages: g(idx.msgs), quotes: g(idx.quotes), sales: g(idx.sales), salesAmount: g(idx.amount), source });
  });
  return { out, errors };
}

export function metricsToRows(s: State, ms: Metric[]): (string | number)[][] {
  return [
    [...COLUMNS],
    ...ms.map((m) => [m.date, s.campaigns.find((c) => c.id === m.campaignId)?.name ?? "", m.network, s.products.find((p) => p.id === m.productId)?.name ?? "", m.spend, m.reach, m.views, m.interactions, m.clicks, m.messages, m.quotes, m.sales, m.salesAmount]),
  ];
}

export const toCSV = (rows: (string | number)[][]) => "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
