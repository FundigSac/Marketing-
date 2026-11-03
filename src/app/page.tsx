"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpRight, CalendarPlus, Clapperboard, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button, Dialog, DialogContent } from "@/components/ui/primitives";
import { PageSkeleton } from "@/components/ui/blocks";
import { IdeaActions } from "@/components/idea-actions";
import { TaskDialog } from "@/components/task-dialog";
import { generateIdeas } from "@/lib/actions";
import { isOverdue, upcomingEvents } from "@/lib/domain";
import { useMe } from "@/lib/store";
import { COLUMNS, EVENT_CATEGORIES } from "@/lib/types";
import { daysBetween, fmtDate, todayLima } from "@/lib/utils";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
const longDate = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
const dayParts = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); return { day: d.getUTCDate(), mon: new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(d).replace(".", "") }; };
const ease = [0.22, 1, 0.36, 1] as const;

/** Inicio en una sola columna (ref. 21st.dev "Inbox Calendar"): lo de hoy, lo que está en producción y lo que viene. */
export default function Inicio() {
  const { s, me, ready } = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [create, setCreate] = useState(false);
  const today = todayLima();

  const d = useMemo(() => {
    if (!ready) return null;
    const dates = upcomingEvents(s.events, today, 60).filter((u) => u.e.category !== "publicacion" && (u.e.relevance !== "baja" || u.in <= 14)).slice(0, 4);
    const soonIds = new Set(dates.map((x) => x.e.id));
    const pool = s.ideas.filter((i) => (i.status === "nueva" || i.status === "elegida" || i.favorite) && i.status !== "descartada" && i.status !== "en_produccion");
    const ideas = [...pool].sort((a, b) => Number(soonIds.has(b.eventId ?? "")) - Number(soonIds.has(a.eventId ?? "")) || Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const open = s.tasks.filter((t) => t.status !== "publicado").sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    return { dates, ideas, open, review: s.tasks.filter((t) => t.status === "revision").length, overdue: s.tasks.filter((t) => isOverdue(t, today)).length };
  }, [s, ready, today]);
  if (!d || !me) return <PageSkeleton />;

  const ask = async (eventId?: string) => {
    setBusy(eventId ?? "gen"); setCreate(false);
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay, eventId });
    setBusy("");
    r.ok ? toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : ""}`) : toast.error(r.error);
  };
  const summary = [
    `${d.ideas.length} ${d.ideas.length === 1 ? "idea lista" : "ideas listas"}`,
    `${d.open.length} ${d.open.length === 1 ? "video" : "videos"} en curso`,
    d.review ? `${d.review} por revisar` : null,
    d.overdue ? `${d.overdue} ${d.overdue === 1 ? "atrasado" : "atrasados"}` : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-16">
        <p className="text-sm text-muted-foreground first-letter:uppercase">{longDate(today)}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{greeting()}, {me.name.split(" ")[0]}.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {summary.map((t, i) => <span key={t}>{i > 0 && <span className="mx-2 text-border">/</span>}<span className={t.includes("atrasado") ? "text-destructive" : ""}>{t}</span></span>)}
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="brand" size="lg" className="rounded-full" onClick={() => setCreate(true)}><Plus />Crear contenido</Button>
          <Button variant="outline" size="lg" className="rounded-full" onClick={() => ask()} disabled={busy === "gen"}><Wand2 />{busy === "gen" ? "Pensando…" : "Pedir ideas"}</Button>
        </div>
      </motion.header>

      <Section title="Para grabar" hint="Ideas de la IA ordenadas por cercanía de fecha" href="/ideas" delay={0.1}>
        {d.ideas.length === 0 ? <Empty text="Aún no hay ideas. Pide ideas a la IA." /> : d.ideas.map((i, k) => (
          <Row key={i.id} index={k}>
            <span className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground/60">{String(k + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/ideas?idea=${i.id}`} className="text-[15px] font-medium leading-snug hover:underline">{i.title}</Link>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{i.concept}</p>
              <p className="mt-2 text-xs text-muted-foreground/80">{i.platform} · {i.duration}{i.date ? ` · ${fmtDate(i.date)}` : ""}{i.favorite ? " · Favorita" : ""}</p>
              {k === 0 && <div className="mt-4"><IdeaActions idea={i} /></div>}
            </div>
          </Row>
        ))}
      </Section>

      <Section title="En producción" hint="Cada punto es una etapa: por hacer, edición, revisión, aprobado, publicado" href="/videos" delay={0.2}>
        {d.open.length === 0 ? <Empty text="Nada en producción. Convierte una idea en video." /> : d.open.slice(0, 5).map((t, k) => {
          const n = t.due ? daysBetween(today, t.due) : null, at = COLUMNS.findIndex((c) => c.id === t.status);
          return (
            <Row key={t.id} index={k} href={`/videos?tarea=${t.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{t.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.changes ? "Correcciones pedidas" : COLUMNS[at].label}{n !== null && <> · <span className={n < 0 ? "text-destructive" : n <= 3 ? "text-brand" : ""}>{n < 0 ? `atrasado ${-n} d` : n === 0 ? "entrega hoy" : `entrega ${fmtDate(t.due)}`}</span></>}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" aria-label={`Etapa ${at + 1} de 5`}>
                {COLUMNS.map((c, j) => <span key={c.id} title={c.label} className={`size-2 rounded-full ${j < at ? "bg-foreground/70" : j === at ? "bg-brand ring-4 ring-brand/15" : "bg-foreground/15"}`} />)}
              </div>
            </Row>
          );
        })}
      </Section>

      <Section title="Lo que viene" hint="Fechas del calendario con relevancia para FUNDIGSAC" href="/calendario" delay={0.3}>
        {d.dates.length === 0 ? <Empty text="Sin fechas próximas. Agrégalas en el calendario." /> : d.dates.map(({ e, date, in: n }, k) => {
          const c = s.ideas.filter((i) => i.eventId === e.id && i.status !== "descartada").length, p = dayParts(date);
          return (
            <Row key={e.id + date} index={k}>
              <div className="w-12 shrink-0 text-center leading-none"><p className="text-2xl font-semibold tabular-nums tracking-tight">{p.day}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{p.mon}</p></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n === 0 ? "Hoy" : `En ${n} ${n === 1 ? "día" : "días"}`} · {EVENT_CATEGORIES[e.category].label}</p>
              </div>
              {c > 0 ? <Link href="/ideas" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">{c} ideas</Link> : <Button size="sm" variant="ghost" className="shrink-0 rounded-full" onClick={() => ask(e.id)} disabled={busy === e.id}><Sparkles className="text-brand" />{busy === e.id ? "…" : "Ideas"}</Button>}
            </Row>
          );
        })}
      </Section>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Crear contenido" description="¿Por dónde quieres empezar?">
          <div className="divide-y divide-border">
            {[
              { icon: Wand2, t: "Ideas con IA", d: `${s.prefs.ideasPerDay} ideas nuevas en segundos`, f: () => ask() },
              { icon: Clapperboard, t: "Nuevo video", d: "Ya sé qué grabar", f: () => { setCreate(false); setTaskOpen(true); } },
              { icon: CalendarPlus, t: "Nueva fecha", d: "Agregar al calendario", f: () => { setCreate(false); router.push("/calendario?nuevo=1"); } },
            ].map((o) => <button key={o.t} onClick={o.f} className="group flex w-full items-center gap-4 py-4 text-left"><o.icon className="size-5 text-brand" /><span className="flex-1"><b className="block text-sm font-medium">{o.t}</b><span className="text-xs text-muted-foreground">{o.d}</span></span><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" /></button>)}
          </div>
        </DialogContent>
      </Dialog>
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}

function Section({ title, hint, href, delay, children }: { title: string; hint: string; href: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease }} className="mb-16">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{hint}</p></div>
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">Ver todo<ArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
      </div>
      <ul>{children}</ul>
    </motion.section>
  );
}

function Row({ index, href, children }: { index: number; href?: string; children: React.ReactNode }) {
  const cls = "flex items-start gap-4 border-b border-border/60 py-5 last:border-0";
  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.15 + index * 0.05, ease }}>
      {href ? <Link href={href} className={`${cls} -mx-3 items-center rounded-xl px-3 transition-colors hover:bg-accent/50`}>{children}</Link> : <div className={cls}>{children}</div>}
    </motion.li>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="py-8 text-sm text-muted-foreground">{text}</li>;
}
