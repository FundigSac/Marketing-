"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Card, Skeleton } from "./primitives";
import { cn } from "@/lib/utils";

export function PageHeader({ title, hint, actions, eyebrow }: { title: string; hint?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-12 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">{title}</h1>
        {hint && <p className="mt-3 max-w-2xl text-base text-muted-foreground">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"><Icon className="size-5" /></span>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Número con entrada suave. El valor real se muestra siempre (sin contar desde cero) para no confundir. */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  return <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>{format ? format(value) : Math.round(value).toString()}</motion.span>;
}

export function StatCard({ label, value, icon: Icon, tone = "primary", format, sub, href }: {
  label: string; value: number; icon: LucideIcon; tone?: "primary" | "brand" | "success" | "danger"; format?: (n: number) => string; sub?: string; href?: string;
}) {
  const tones = { primary: "bg-secondary text-secondary-foreground", brand: "bg-brand/15 text-brand", success: "bg-success/15 text-success", danger: "bg-destructive/15 text-destructive" };
  const body = (
    <Card className="group h-full p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-8 place-items-center rounded-md", tones[tone])}><Icon className="size-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums"><CountUp value={value} format={format} /></p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
  return href ? <a href={href} className="block h-full">{body}</a> : body;
}

/** Entrada escalonada para rejillas de tarjetas. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
      {children}
    </motion.div>
  );
}
export function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }}>{children}</motion.div>;
}

/** Markdown mínimo (títulos, viñetas, negritas, tablas simples) para respuestas de la IA. */
export function Md({ text, className }: { text: string; className?: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`ul-${out.length}-${lines.length}`} className="my-1 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  lines.forEach((raw, k) => {
    const l = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(l)) { list.push(l.replace(/^\s*[-*•]\s+/, "")); return; }
    flush();
    if (/^\|?[\s:-]+\|[\s|:-]*$/.test(l)) return;
    if (l.startsWith("|")) { out.push(<p key={`t-${k}`} className="font-mono text-xs">{l.split("|").filter(Boolean).map((c) => c.trim()).join(" · ")}</p>); return; }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) { out.push(<p key={`h-${k}`} className="mt-2 font-semibold">{inline(h[2])}</p>); return; }
    if (l.trim()) out.push(<p key={`p-${k}`}>{inline(l)}</p>);
  });
  flush();
  return <div className={cn("space-y-1.5 text-sm leading-relaxed", className)}>{out}</div>;
}

/** Anillo de progreso (SVG) con animación de entrada. */
export function Ring({ pct, size = 92, stroke = 9, tone = "var(--brand)", children }: { pct: number; size?: number; stroke?: number; tone?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, pct)) / 100) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Pestañas tipo segmento con indicador que se desliza (resorte). */
export function Seg<T extends string>({ value, onChange, items, id }: { value: T; onChange: (v: T) => void; items: { id: T; label: React.ReactNode }[]; id: string }) {
  return (
    <div role="tablist" className="relative inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)} className={cn("relative rounded-md px-3 py-1 text-sm font-medium transition-colors", value === it.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {value === it.id && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-card shadow-[var(--shadow-sm)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), w = 100, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-24", className)} preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Barras mínimas (ref. 21st.dev "Stats Card"): la última barra va en color de marca. */
export function MiniBars({ data, labels, className }: { data: number[]; labels?: string[]; className?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className={cn("flex h-12 items-end gap-1.5", className)} aria-hidden>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <motion.div title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)} className={cn("w-full rounded-t-[5px] rounded-b-[2px]", i === data.length - 1 ? "bg-brand" : "bg-foreground/15")}
            initial={{ height: 3 }} animate={{ height: Math.max(3, (v / max) * 40) }} transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      ))}
    </div>
  );
}

/** Indicador con número grande, contexto y tendencia de las últimas semanas. */
export function Kpi({ label, value, sub, icon: Icon, bars, href }: { label: string; value: number; sub: string; icon: LucideIcon; bars: number[]; href?: string }) {
  const body = (
    <Card className="surface-hover flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-2 truncate text-[13px] text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg border border-border bg-muted"><Icon className="size-3.5" /></span>{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-gradient text-[26px] font-semibold leading-none tracking-tight tabular-nums sm:text-[32px]"><CountUp value={value} /></p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <MiniBars data={bars} className="hidden w-24 shrink-0 sm:flex" />
      </div>
    </Card>
  );
  return href ? <a href={href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{body}</a> : body;
}
