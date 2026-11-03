"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, Skeleton } from "./primitives";
import { cn } from "@/lib/utils";

export function PageHeader({ title, hint, actions, eyebrow }: { title: string; hint?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {hint && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{hint}</p>}
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

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toString()));
  useEffect(() => { if (inView) { const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] }); return () => c.stop(); } }, [inView, value, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
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
