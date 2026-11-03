"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, CalendarPlus, CheckCircle2, Clapperboard, Clock, Eye, Heart, Lightbulb, Plus, Sparkles, Wand2 } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Progress } from "@/components/ui/primitives";
import { EmptyState, Item, Kpi, PageSkeleton, Ring, Stagger } from "@/components/ui/blocks";
import { IdeaActions } from "@/components/idea-actions";
import { TaskDialog } from "@/components/task-dialog";
import { generateIdeas } from "@/lib/actions";
import { isOverdue, monthRange, periodProgress, taskProgress, upcomingEvents, weekRange } from "@/lib/domain";
import { productName, update, useMe } from "@/lib/store";
import { COLUMNS, EVENT_CATEGORIES } from "@/lib/types";
import { addDays, daysBetween, fmtDate, todayLima } from "@/lib/utils";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
const longDate = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
const dayTile = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); return { day: d.getUTCDate(), mon: new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(d).replace(".", "") }; };

/** Cuántas fechas caen en cada una de las últimas 6 semanas (la última termina hoy). */
function weekly(dates: (string | undefined)[], today: string) {
  return Array.from({ length: 6 }, (_, k) => {
    const to = addDays(today, -7 * (5 - k)), from = addDays(to, -6);
    return dates.filter((d) => d && d.slice(0, 10) >= from && d.slice(0, 10) <= to).length;
  });
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
    const ideas = [...pool].sort((a, b) => Number(soonIds.has(b.eventId ?? "")) - Number(soonIds.has(a.eventId ?? "")) || Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const open = s.tasks.filter((t) => t.status !== "publicado");
    const m = monthRange(today);
    return {
      dates, ideas,
      pending: [...open].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 4),
      openCount: open.length,
      todayIdeas: s.ideas.filter((i) => i.status !== "descartada" && (i.batch ?? i.createdAt.slice(0, 10)) === today).length,
      review: s.tasks.filter((t) => t.status === "revision").length,
      published: s.tasks.filter((t) => t.publishedAt && t.publishedAt.slice(0, 10) >= m.from && t.publishedAt.slice(0, 10) <= m.to).length,
      bars: {
        ideas: weekly(s.ideas.map((i) => i.createdAt), today),
        tasks: weekly(s.tasks.map((t) => t.createdAt), today),
        review: weekly(s.tasks.map((t) => t.deliveredAt), today),
        published: weekly(s.tasks.map((t) => t.publishedAt), today),
      },
      week: periodProgress(s.tasks, weekRange(today).from, weekRange(today).to),
      month: periodProgress(s.tasks, m.from, m.to),
    };
  }, [s, ready, today]);
  if (!d || !me) return <PageSkeleton />;

  const next = d.dates[0];
  const overdue = s.tasks.filter((t) => isOverdue(t, today)).length;
  const line = overdue
    ? `Tienes ${overdue} entrega${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}. Conviene empezar por ahí.`
    : next
      ? `${next.e.title} es ${next.in === 0 ? "hoy" : `en ${next.in} ${next.in === 1 ? "día" : "días"}`}. Hay ${d.ideas.length || "pocas"} ideas listas para grabar.`
      : d.ideas.length ? `Hay ${d.ideas.length} ideas listas para grabar.` : "Pide ideas a la IA o agrega una fecha en el calendario.";

  const ask = async (eventId?: string) => {
    setBusy(eventId ?? "gen"); setCreate(false);
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay, eventId });
    setBusy("");
    r.ok ? toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : ""}`) : toast.error(r.error);
  };
  const fav = (id: string) => update((x) => { const i = x.ideas.find((q) => q.id === id)!; i.favorite = !i.favorite; });
  const [hero, ...rest] = d.ideas;

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground first-letter:uppercase">{longDate(today)}</p>
          <h1 className="text-gradient mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting()}, {me.name.split(" ")[0]}</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{line}</p>
        </div>
        <Button variant="brand" size="lg" onClick={() => setCreate(true)}><Plus />Crear contenido</Button>
      </header>

      <Stagger className="space-y-5">
        <Item className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi label="Ideas de hoy" value={d.todayIdeas} sub={`Meta diaria: ${s.prefs.ideasPerDay}`} icon={Lightbulb} bars={d.bars.ideas} href="/ideas" />
          <Kpi label="Videos en curso" value={d.openCount} sub={overdue ? `${overdue} atrasado${overdue > 1 ? "s" : ""}` : "Al día"} icon={Clapperboard} bars={d.bars.tasks} href="/videos" />
          <Kpi label="Por revisar" value={d.review} sub="Esperan aprobación" icon={Eye} bars={d.bars.review} href="/videos" />
          <Kpi label="Publicados" value={d.published} sub="En este mes" icon={CheckCircle2} bars={d.bars.published} href="/videos" />
        </Item>

        <Item>
          <Card className="spotlight min-w-0 p-5 sm:p-7">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              {hero ? (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone="brand"><Sparkles className="size-3" />Idea destacada</Badge>
                    <button aria-label={hero.favorite ? "Quitar de favoritas" : "Guardar como favorita"} aria-pressed={hero.favorite} onClick={() => fav(hero.id)} className={`rounded-md p-1.5 transition active:scale-90 ${hero.favorite ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}><Heart className={`size-5 ${hero.favorite ? "fill-current" : ""}`} /></button>
                  </div>
                  <Link href={`/ideas?idea=${hero.id}`} className="mt-4 block text-xl font-semibold leading-snug tracking-tight hover:underline sm:text-2xl">{hero.title}</Link>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{hero.concept}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge>{productName(s, hero.productId) || hero.productName || "Producto por definir"}</Badge>
                    <Badge><Clock className="size-3" />{hero.duration}</Badge><Badge>{hero.platform}</Badge>
                    {hero.date && <Badge tone="primary">{fmtDate(hero.date)}</Badge>}
                  </div>
                  <div className="mt-6"><IdeaActions idea={hero} /></div>
                </div>
              ) : <EmptyState icon={Sparkles} title="Aún no hay ideas" text={`La IA propone ${s.prefs.ideasPerDay} ideas por día según tus fechas y productos HDPE.`} action={<Button variant="brand" onClick={() => ask()} disabled={busy === "gen"}><Wand2 />{busy === "gen" ? "Pensando…" : "Generar ideas"}</Button>} />}
              <div className="flex justify-around gap-4 border-t border-border pt-6 lg:flex-col lg:justify-center lg:gap-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                {([["Esta semana", d.week], ["Este mes", d.month]] as const).map(([l, p]) => (
                  <div key={l} className="flex items-center gap-3">
                    <Ring pct={p.pct} size={64} stroke={6}><span className="text-sm font-semibold tabular-nums">{p.pct}%</span></Ring>
                    <div className="whitespace-nowrap"><p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{p.total ? `${p.done} de ${p.total} listos` : "Sin entregas"}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Item>

        <Item className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="p-5">
            <Head title="Más ideas" href="/ideas" link="Ver todas" />
            {rest.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Cuando la IA proponga más ideas aparecerán aquí.</p> : (
              <ul className="space-y-1">{rest.map((i, k) => (
                <motion.li key={i.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + k * 0.05 }}>
                  <Link href={`/ideas?idea=${i.id}`} className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-accent">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{k + 2}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{i.title}</b><span className="text-xs text-muted-foreground">{i.platform} · {i.duration}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                </motion.li>))}</ul>
            )}
          </Card>

          <Card className="p-5">
            <Head title="Próximas fechas" href="/calendario" link="Calendario" />
            {d.dates.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Sin fechas próximas. Agrégalas en el calendario.</p> : (
              <ul className="space-y-1">{d.dates.map(({ e, date, in: n }) => {
                const c = s.ideas.filter((i) => i.eventId === e.id && i.status !== "descartada").length, t = dayTile(date);
                return (
                  <li key={e.id + date} className="flex items-center gap-3 rounded-xl p-2.5">
                    <span className="grid w-11 shrink-0 place-items-center rounded-lg border border-border bg-muted py-1 leading-none"><b className="text-base tabular-nums">{t.day}</b><span className="mt-0.5 text-[10px] uppercase text-muted-foreground">{t.mon}</span></span>
                    <div className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{e.title}</b><span className="text-xs text-muted-foreground">{n === 0 ? "Hoy" : `En ${n} ${n === 1 ? "día" : "días"}`} · {EVENT_CATEGORIES[e.category].label}</span></div>
                    {c > 0 ? <Link href="/ideas" className="text-xs text-muted-foreground hover:text-foreground">{c} ideas</Link> : <Button size="sm" variant="outline" onClick={() => ask(e.id)} disabled={busy === e.id}>{busy === e.id ? "…" : "Ideas"}</Button>}
                  </li>);
              })}</ul>
            )}
          </Card>

          <Card className="p-5">
            <Head title="Mis videos" href="/videos" link="Tablero" />
            {d.pending.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nada pendiente. Convierte una idea en video.</p> : (
              <ul className="space-y-1">{d.pending.map((t) => {
                const n = t.due ? daysBetween(today, t.due) : null;
                return (
                  <li key={t.id}><Link href={`/videos?tarea=${t.id}`} className="block rounded-xl p-2.5 transition-colors hover:bg-accent">
                    <div className="flex items-center justify-between gap-2"><b className="truncate text-sm font-medium">{t.title}</b><Badge tone={n !== null && n < 0 ? "danger" : n !== null && n <= 3 ? "brand" : "neutral"}>{n === null ? "Sin fecha" : n < 0 ? `Atrasado ${-n} d` : n === 0 ? "Hoy" : fmtDate(t.due)}</Badge></div>
                    <div className="mt-2 flex items-center gap-2.5"><Progress value={taskProgress(t)} tone="brand" className="h-1 flex-1" /><span className="whitespace-nowrap text-[11px] text-muted-foreground">{t.changes ? "Correcciones" : COLUMNS.find((c) => c.id === t.status)?.label}</span></div>
                  </Link></li>);
              })}</ul>
            )}
          </Card>
        </Item>
      </Stagger>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Crear contenido" description="¿Por dónde quieres empezar?">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Wand2, t: "Ideas con IA", d: `${s.prefs.ideasPerDay} ideas nuevas`, f: () => ask() },
              { icon: Clapperboard, t: "Nuevo video", d: "Ya sé qué grabar", f: () => { setCreate(false); setTaskOpen(true); } },
              { icon: CalendarPlus, t: "Nueva fecha", d: "En el calendario", f: () => { setCreate(false); router.push("/calendario?nuevo=1"); } },
            ].map((o) => <button key={o.t} onClick={o.f} className="surface surface-hover rounded-xl border border-border p-4 text-left"><o.icon className="mb-3 size-5 text-brand" /><b className="block text-sm">{o.t}</b><span className="text-xs text-muted-foreground">{o.d}</span></button>)}
          </div>
        </DialogContent>
      </Dialog>
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}

function Head({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Link href={href} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">{link}<ArrowRight className="size-3" /></Link>
    </div>
  );
}
