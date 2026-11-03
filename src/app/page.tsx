"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, Clapperboard, Heart, Plus, Sparkles, Wand2 } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Progress } from "@/components/ui/primitives";
import { EmptyState, Item, PageSkeleton, Stagger } from "@/components/ui/blocks";
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
    const dates = upcomingEvents(s.events, today, 60).filter((u) => u.e.category !== "publicacion" && (u.e.relevance !== "baja" || u.in <= 14)).slice(0, 3);
    const soonIds = new Set(dates.map((x) => x.e.id));
    const pool = s.ideas.filter((i) => (i.status === "nueva" || i.status === "elegida" || i.favorite) && i.status !== "descartada" && i.status !== "en_produccion");
    const ideas = [...pool].sort((a, b) => Number(soonIds.has(b.eventId ?? "")) - Number(soonIds.has(a.eventId ?? "")) || Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
    const open = s.tasks.filter((t) => t.status !== "publicado");
    return {
      dates, ideas,
      pending: [...open].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 4),
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

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {me.name.split(" ")[0]}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{line}</p>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
            {([["Esta semana", d.week], ["Este mes", d.month]] as const).map(([l, p]) => (
              <div key={l} className="flex items-center gap-2.5"><span>{l}</span><Progress value={p.pct} className="h-1.5 w-24" /><span className="tabular-nums text-foreground">{p.total ? `${p.done} de ${p.total} listos` : "sin entregas"}</span></div>
            ))}
          </div>
        </div>
        <Button size="lg" onClick={() => setCreate(true)}><Plus />Crear contenido</Button>
      </header>

      <Stagger className="grid gap-5 lg:grid-cols-5">
        <Item className="lg:col-span-3">
          <Card className="h-full p-5">
            <div className="mb-1 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" />Ideas recomendadas</h2><Link href="/ideas" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link></div>
            {d.ideas.length === 0 ? <EmptyState icon={Sparkles} title="Aún no hay ideas" text="La IA propone 3 a 5 ideas por día según tus fechas y productos HDPE." action={<Button size="sm" onClick={() => ask()} disabled={busy === "gen"}><Wand2 />{busy === "gen" ? "Pensando…" : "Generar ideas"}</Button>} /> : (
              <ul className="divide-y divide-border">{d.ideas.map((i) => (
                <li key={i.id} className="py-4 first:pt-3 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/ideas?idea=${i.id}`} className="font-medium hover:text-primary">{i.title}</Link>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.concept}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-1.5"><Badge>{i.platform}</Badge><Badge>{i.duration}</Badge>{i.date && <Badge tone="primary">{fmtDate(i.date)}</Badge>}</p>
                    </div>
                    <button aria-label={i.favorite ? "Quitar de favoritas" : "Guardar como favorita"} aria-pressed={i.favorite} onClick={() => fav(i.id)} className={`rounded-md p-1.5 transition-colors ${i.favorite ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}><Heart className={`size-4 ${i.favorite ? "fill-current" : ""}`} /></button>
                  </div>
                  <div className="mt-3"><IdeaActions idea={i} /></div>
                </li>))}</ul>
            )}
          </Card>
        </Item>

        <div className="space-y-5 lg:col-span-2">
          <Item>
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-muted-foreground" />Próximas fechas</h2><Link href="/calendario" className="text-xs text-muted-foreground hover:text-foreground">Calendario</Link></div>
              {d.dates.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Sin fechas próximas. Agrégalas en el calendario.</p> : (
                <ul className="divide-y divide-border">{d.dates.map(({ e, date, in: n }) => { const c = s.ideas.filter((i) => i.eventId === e.id && i.status !== "descartada").length; return (
                  <li key={e.id + date} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><b className="block truncate font-medium">{e.title}</b><span className="text-xs text-muted-foreground">{fmtDate(date)} · {n === 0 ? "hoy" : `en ${n} ${n === 1 ? "día" : "días"}`} · {EVENT_CATEGORIES[e.category].label}</span></div>
                    {c > 0 ? <Link href="/ideas" className="text-xs text-primary hover:underline">{c} ideas</Link> : <Button size="sm" variant="outline" onClick={() => ask(e.id)} disabled={busy === e.id}>{busy === e.id ? "…" : "Pedir ideas"}</Button>}
                  </li>); })}</ul>
              )}
            </Card>
          </Item>
          <Item>
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Clapperboard className="size-4 text-muted-foreground" />Mis videos</h2><Link href="/videos" className="text-xs text-muted-foreground hover:text-foreground">Ver tablero</Link></div>
              {d.pending.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Nada pendiente. Convierte una idea en video.</p> : (
                <ul className="divide-y divide-border">{d.pending.map((t) => { const n = t.due ? daysBetween(today, t.due) : null; return (
                  <li key={t.id}><Link href={`/videos?tarea=${t.id}`} className="block py-2.5"><div className="flex items-center justify-between gap-2"><b className="truncate font-medium">{t.title}</b><Badge tone={n !== null && n < 0 ? "danger" : n !== null && n <= 3 ? "brand" : "neutral"}>{n === null ? "sin fecha" : n < 0 ? `atrasado ${-n} d` : n === 0 ? "hoy" : fmtDate(t.due)}</Badge></div><div className="mt-1.5 flex items-center gap-2"><Progress value={taskProgress(t)} className="h-1" /><span className="whitespace-nowrap text-xs text-muted-foreground">{t.changes ? "Correcciones" : COLUMNS.find((c) => c.id === t.status)?.label}</span></div></Link></li>); })}
                  {d.pendingCount > 4 && <li className="pt-2.5 text-xs text-muted-foreground">y {d.pendingCount - 4} más…</li>}</ul>
              )}
            </Card>
          </Item>
        </div>
      </Stagger>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Crear contenido" description="¿Por dónde quieres empezar?">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: Wand2, t: "Ideas con IA", d: `${s.prefs.ideasPerDay} ideas nuevas`, f: () => ask() },
              { icon: Clapperboard, t: "Nuevo video", d: "Ya sé qué grabar", f: () => { setCreate(false); setTaskOpen(true); } },
              { icon: CalendarPlus, t: "Nueva fecha", d: "En el calendario", f: () => { setCreate(false); router.push("/calendario?nuevo=1"); } },
            ].map((o) => <button key={o.t} onClick={o.f} className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"><o.icon className="mb-3 size-5 text-primary" /><b className="block text-sm">{o.t}</b><span className="text-xs text-muted-foreground">{o.d}</span></button>)}
          </div>
        </DialogContent>
      </Dialog>
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}
