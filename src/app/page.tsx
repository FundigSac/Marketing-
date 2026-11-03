"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { CalendarClock, CalendarPlus, Clapperboard, Heart, Plus, Sparkles, Wand2 } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Progress } from "@/components/ui/primitives";
import { CountUp, EmptyState, Item, PageSkeleton, Ring, Stagger } from "@/components/ui/blocks";
import { IdeaActions } from "@/components/idea-actions";
import { TaskDialog } from "@/components/task-dialog";
import { generateIdeas } from "@/lib/actions";
import { isOverdue, monthRange, periodProgress, taskProgress, upcomingEvents, weekRange } from "@/lib/domain";
import { update, useMe } from "@/lib/store";
import { COLUMNS, EVENT_CATEGORIES } from "@/lib/types";
import { daysBetween, fmtDate, todayLima } from "@/lib/utils";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

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
    const ideas = [...pool].sort((a, b) => Number(soonIds.has(b.eventId ?? "")) - Number(soonIds.has(a.eventId ?? "")) || Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
    const open = s.tasks.filter((t) => t.status !== "publicado");
    return {
      dates, ideas,
      pending: [...open].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 5),
      pendingCount: open.length,
      week: periodProgress(s.tasks, weekRange(today).from, weekRange(today).to),
      month: periodProgress(s.tasks, monthRange(today).from, monthRange(today).to),
    };
  }, [s, ready, today]);
  if (!d || !me) return <PageSkeleton />;

  const next = d.dates[0];
  const ideasForNext = next ? s.ideas.filter((i) => i.eventId === next.e.id && i.status !== "descartada").length : 0;
  const total = ideasForNext || d.ideas.length;
  const overdue = s.tasks.filter((t) => isOverdue(t, today)).length;
  const line = overdue
    ? `Tienes ${overdue} entrega${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}. Empecemos por ahí.`
    : next
      ? `Se acerca una fecha importante (${next.e.title}, ${next.in === 0 ? "hoy" : `en ${next.in} ${next.in === 1 ? "día" : "días"}`}) y ${total ? `tengo ${total} ${total === 1 ? "idea" : "ideas"} de videos para FUNDIGSAC.` : "puedo prepararte ideas de videos para FUNDIGSAC."}`
      : total ? `Tengo ${total} ideas de videos para FUNDIGSAC.` : "Pide ideas a la IA o planifica una fecha en el calendario.";

  const ask = async (eventId?: string) => {
    setBusy(eventId ?? "gen"); setCreate(false);
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay, eventId });
    setBusy("");
    r.ok ? toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : ""}`) : toast.error(r.error);
  };
  const fav = (id: string) => update((x) => { const i = x.ideas.find((q) => q.id === id)!; i.favorite = !i.favorite; });
  const longDate = new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeZone: "America/Lima" }).format(new Date());

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="gborder relative mb-5 overflow-hidden rounded-3xl border border-border bg-card/80 p-6 shadow-[var(--shadow-md)] md:p-8">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-brand/20 blur-3xl" style={{ animation: "float-y 9s ease-in-out infinite" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-primary/20 blur-3xl" style={{ animation: "float-y 11s ease-in-out infinite reverse" }} />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0 max-w-2xl">
            <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-sm)]"><Sparkles className="size-3.5 text-brand" />Briefing de hoy · {longDate.charAt(0).toUpperCase() + longDate.slice(1)}</motion.span>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">{greeting()},<br /><span className="text-gradient">{me.name.split(" ")[0]}</span> <span aria-hidden className="inline-block origin-[70%_70%]" style={{ animation: "float-y 3s ease-in-out infinite" }}>👋</span></h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">{line}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="brand" size="lg" onClick={() => setCreate(true)} className="h-12 px-6 text-base"><Plus />Crear contenido</Button>
              <div className="flex flex-wrap gap-2 text-xs">
                {[["Ideas listas", d.ideas.length + (ideasForNext && !d.ideas.length ? ideasForNext : 0)], ["Videos en curso", d.pendingCount], ["Atrasados", overdue]].map(([l, n]) => <span key={String(l)} className="rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-[var(--shadow-sm)]"><b className="tabular-nums text-foreground"><CountUp value={Number(n)} /></b> <span className="text-muted-foreground">{l}</span></span>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-sm)] backdrop-blur">
            {([["Semana", d.week, "var(--brand)"], ["Mes", d.month, "var(--primary)"]] as const).map(([l, p2, tone]) => (
              <div key={l} className="flex flex-col items-center gap-2 text-center"><Ring pct={p2.pct} size={92} stroke={9} tone={tone}><b className="text-lg tabular-nums">{p2.total ? `${p2.pct}%` : "—"}</b></Ring><div className="text-xs leading-tight"><b className="block text-sm">{l}</b><span className="text-muted-foreground">{p2.total ? `${p2.done}/${p2.total} aprobados` : "sin entregas"}</span></div></div>
            ))}
          </div>
        </div>
      </motion.section>

      <Stagger className="grid gap-4 lg:grid-cols-12">
        <Item className="lg:col-span-7">
          <Card className="h-full p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" />Ideas recomendadas por la IA</h2><Link href="/ideas" className="text-xs text-primary hover:underline">Ver todas</Link></div>
            {d.ideas.length === 0 ? <EmptyState icon={Sparkles} title="Aún no hay ideas" text="La IA propone 3 a 5 ideas por día según tus fechas y productos HDPE." action={<Button size="sm" variant="brand" onClick={() => ask()} disabled={busy === "gen"}><Wand2 />{busy === "gen" ? "Pensando…" : "Generar ideas"}</Button>} /> : (
              <ul className="space-y-2.5">{d.ideas.map((i, k) => (
                <li key={i.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-3.5 pl-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[image:var(--grad-brand)] opacity-70 transition-opacity group-hover:opacity-100" /><span aria-hidden className="absolute right-3 top-2 text-5xl font-black leading-none text-foreground/[0.05]">{String(k + 1).padStart(2, "0")}</span>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/ideas?idea=${i.id}`} className="line-clamp-1 font-medium hover:text-primary">{i.title}</Link>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{i.concept}</p>
                      <p className="mt-1.5 text-xs"><b>Por qué:</b> <span className="text-muted-foreground">{i.why}</span></p>
                    </div>
                    <button aria-label={i.favorite ? "Quitar de favoritas" : "Guardar como favorita"} aria-pressed={i.favorite} onClick={() => fav(i.id)} className={`rounded-md p-1.5 transition active:scale-90 ${i.favorite ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}><Heart className={`size-4 ${i.favorite ? "fill-current" : ""}`} /></button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2"><span className="flex gap-1.5"><Badge>{i.platform}</Badge><Badge>{i.duration}</Badge>{i.date && <Badge tone="primary">{fmtDate(i.date)}</Badge>}</span><IdeaActions idea={i} compact /></div>
                </li>))}</ul>
            )}
          </Card>
        </Item>

        <div className="space-y-4 lg:col-span-5">
          <Item>
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-brand" />Próximas fechas</h2><Link href="/calendario" className="text-xs text-primary hover:underline">Calendario</Link></div>
              {d.dates.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Sin fechas próximas. Agrégalas en el calendario.</p> : (
                <ul>{d.dates.map(({ e, date, in: n }) => { const c = s.ideas.filter((i) => i.eventId === e.id && i.status !== "descartada").length; return (
                  <li key={e.id + date} className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-accent">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none text-secondary-foreground"><b className="text-sm">{n}</b><span className="text-[9px]">{n === 1 ? "día" : "días"}</span></span>
                    <div className="min-w-0 flex-1"><b className="block truncate text-sm">{e.title}</b><span className="text-xs text-muted-foreground">{fmtDate(date)} · {EVENT_CATEGORIES[e.category].label}</span></div>
                    {c > 0 ? <Link href="/ideas" className="text-xs text-primary hover:underline">{c} ideas</Link> : <Button size="sm" variant="soft" onClick={() => ask(e.id)} disabled={busy === e.id}><Sparkles />{busy === e.id ? "…" : "Ideas"}</Button>}
                  </li>); })}</ul>
              )}
            </Card>
          </Item>
          <Item>
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Clapperboard className="size-4 text-brand" />Videos pendientes</h2><Link href="/videos" className="text-xs text-primary hover:underline">Mis videos</Link></div>
              {d.pending.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nada pendiente. Convierte una idea en video.</p> : (
                <ul className="space-y-2.5">{d.pending.map((t) => { const n = t.due ? daysBetween(today, t.due) : null; return (
                  <li key={t.id}><Link href={`/videos?tarea=${t.id}`} className="block rounded-lg p-1.5 transition hover:bg-accent"><div className="flex items-center justify-between gap-2 text-sm"><b className="truncate">{t.title}</b><Badge tone={n !== null && n < 0 ? "danger" : n !== null && n <= 3 ? "brand" : "neutral"}>{n === null ? "sin fecha" : n < 0 ? `atrasado ${-n} d` : n === 0 ? "entrega hoy" : `entrega ${fmtDate(t.due)}`}</Badge></div><div className="mt-1.5 flex items-center gap-2"><Progress value={taskProgress(t)} className="h-1.5" tone="brand" /><span className="whitespace-nowrap text-[11px] text-muted-foreground">{t.changes ? "con correcciones" : COLUMNS.find((c) => c.id === t.status)?.label}</span></div></Link></li>); })}
                  {d.pendingCount > 5 && <li className="px-1.5 text-xs text-muted-foreground">y {d.pendingCount - 5} más en Mis videos…</li>}</ul>
              )}
            </Card>
          </Item>
        </div>
      </Stagger>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Crear contenido" description="¿Por dónde quieres empezar?">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Wand2, t: "Ideas con IA", d: `${s.prefs.ideasPerDay} ideas nuevas`, f: () => ask(), tone: "bg-brand/15 text-brand" },
              { icon: Clapperboard, t: "Nuevo video", d: "Ya sé qué grabar", f: () => { setCreate(false); setTaskOpen(true); }, tone: "bg-secondary text-secondary-foreground" },
              { icon: CalendarPlus, t: "Nueva fecha", d: "En el calendario", f: () => { setCreate(false); router.push("/calendario?nuevo=1"); }, tone: "bg-secondary text-secondary-foreground" },
            ].map((o) => <button key={o.t} onClick={o.f} className="rounded-xl border border-border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><span className={`mb-3 grid size-9 place-items-center rounded-lg ${o.tone}`}><o.icon className="size-4" /></span><b className="block text-sm">{o.t}</b><span className="text-xs text-muted-foreground">{o.d}</span></button>)}
          </div>
        </DialogContent>
      </Dialog>
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}
