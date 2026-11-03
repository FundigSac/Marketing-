"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, CalendarClock, Film, Lightbulb, ListChecks, Megaphone, MessageSquareQuote, Sparkles, UserRound } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { EmptyState, Item, PageHeader, PageSkeleton, Stagger, StatCard } from "@/components/ui/blocks";
import { useStore } from "@/lib/store";
import { avgProgress, isOverdue, totals, upcomingEvents } from "@/lib/domain";
import { deriveAlerts } from "@/lib/alerts";
import { callAI } from "@/lib/ai-client";
import { EVENT_CATEGORIES } from "@/lib/types";
import { fmtDate, NUM, todayLima } from "@/lib/utils";

export default function Dashboard() {
  const { s, ready } = useStore();
  const today = todayLima();
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");

  const d = useMemo(() => {
    if (!ready) return null;
    const open = s.tasks.filter((t) => !["publicado", "analizado"].includes(t.status));
    const fab = s.users.find((u) => u.name === "Fabrizio");
    const fabTasks = s.tasks.filter((t) => t.assigneeId === fab?.id && !["publicado", "analizado"].includes(t.status));
    const days = [...new Set(s.metrics.map((m) => m.date))].sort().slice(-14);
    return {
      open, fab, fabTasks,
      overdue: open.filter((t) => isOverdue(t, today)),
      upcoming: upcomingEvents(s.events, today, 45).slice(0, 6),
      videos: s.videos.filter((v) => v.status !== "aprobado"),
      active: s.campaigns.filter((c) => c.status === "activa"),
      tot: totals(s.metrics),
      chart: days.map((day) => ({ d: day.slice(5), Mensajes: s.metrics.filter((m) => m.date === day).reduce((a, m) => a + m.messages, 0), Cotizaciones: s.metrics.filter((m) => m.date === day).reduce((a, m) => a + m.quotes, 0) })),
      alerts: deriveAlerts(s, today).slice(0, 5),
      ideas: s.ideas.filter((i) => i.status === "propuesta").slice(0, 3),
    };
  }, [s, ready, today]);

  if (!d) return <PageSkeleton />;

  const askSummary = async () => {
    setBusy(true); setAiErr("");
    const r = await callAI<{ text: string }>(s, "summary", { instruction: "Elabora un resumen semanal de marketing: fechas próximas, avance de Fabrizio, tareas atrasadas, videos pendientes, campañas y prioridades recomendadas para esta semana. Usa solo los datos del contexto." });
    setBusy(false);
    if (r.ok) setSummary(r.data.text); else setAiErr(r.error);
  };

  const hello = new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeZone: "America/Lima" }).format(new Date());

  return (
    <>
      <PageHeader eyebrow="Centro de operaciones" title="Buen día, equipo FUNDIGSAC" hint={hello.charAt(0).toUpperCase() + hello.slice(1)}
        actions={<><Button variant="outline" asChild><Link href="/eventos/nuevo">Nuevo evento</Link></Button><Button variant="brand" asChild><Link href="/ia/ideas"><Sparkles />Ideas de hoy</Link></Button></>} />

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Item><StatCard label="Tareas abiertas" value={d.open.length} icon={ListChecks} href="/produccion/kanban" sub={`${d.overdue.length} atrasadas`} tone={d.overdue.length ? "danger" : "primary"} /></Item>
        <Item><StatCard label="Videos por revisar" value={d.videos.length} icon={Film} href="/produccion/videos" tone="brand" /></Item>
        <Item><StatCard label="Campañas activas" value={d.active.length} icon={Megaphone} href="/campanas" sub={`${s.campaigns.length} en total`} /></Item>
        <Item><StatCard label="Cotizaciones registradas" value={d.tot.quotes} icon={MessageSquareQuote} href="/metricas" tone="success" sub={`${NUM(d.tot.messages)} mensajes`} /></Item>
      </Stagger>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-brand" />Próximas fechas</CardTitle><Link href="/calendario" className="text-xs text-primary hover:underline">Ver calendario</Link></CardHeader>
          <CardContent>
            {d.upcoming.length === 0 ? <EmptyState icon={CalendarClock} title="Sin fechas próximas" text="Agrega fechas importantes para planificar contenido con tiempo." /> : (
              <ul className="divide-y divide-border">
                {d.upcoming.map(({ e, date, in: n }) => (
                  <li key={e.id + date}>
                    <Link href={`/eventos/${e.id}`} className="group flex items-center gap-3 py-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: EVENT_CATEGORIES[e.category].color }} />
                      <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium group-hover:text-primary">{e.title}</b><span className="text-xs text-muted-foreground">{EVENT_CATEGORIES[e.category].label} · {fmtDate(date)}</span></span>
                      <Badge tone={n <= 3 ? "brand" : n <= 14 ? "primary" : "neutral"}>{n === 0 ? "Hoy" : `en ${n} d`}</Badge>
                      <Badge tone={e.relevance === "alta" ? "success" : "neutral"}>{e.relevance}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-brand" />Avance de Fabrizio</CardTitle><Link href="/produccion/fabrizio" className="text-xs text-primary hover:underline">Panel</Link></CardHeader>
          <CardContent className="space-y-3">
            {d.fabTasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin tareas asignadas todavía.</p> : (
              <>
                <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Avance promedio</span><b className="text-foreground">{avgProgress(d.fabTasks)}%</b></div><Progress value={avgProgress(d.fabTasks)} tone="brand" /></div>
                <ul className="space-y-1.5 text-sm">{d.fabTasks.slice(0, 4).map((t) => <li key={t.id} className="flex justify-between gap-2"><Link href={`/produccion/tareas/${t.id}`} className="truncate hover:text-primary">{t.title}</Link>{isOverdue(t, today) && <Badge tone="danger">atrasada</Badge>}</li>)}</ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Mensajes y cotizaciones (últimos días con datos)</CardTitle></CardHeader>
          <CardContent>
            {d.chart.length === 0 ? <EmptyState icon={Megaphone} title="Aún no hay resultados" text="Registra o importa métricas de una campaña para ver el rendimiento aquí." action={<Button variant="outline" size="sm" asChild><Link href="/metricas">Cargar métricas</Link></Button>} /> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={d.chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke="var(--muted-foreground)" /><YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} /><Bar dataKey="Mensajes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cotizaciones" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-brand" />Avisos</CardTitle><Link href="/notificaciones" className="text-xs text-primary hover:underline">Todos</Link></CardHeader>
          <CardContent>
            {d.alerts.length === 0 ? <p className="text-sm text-muted-foreground">Todo en orden por ahora.</p> : (
              <ul className="space-y-2.5">{d.alerts.map((a) => <li key={a.id}><Link href={a.href} className="block rounded-md p-2 text-sm transition hover:bg-accent"><b className="flex items-center gap-2"><span className={`size-2 rounded-full ${a.level === "alta" ? "bg-destructive" : a.level === "media" ? "bg-brand" : "bg-primary"}`} />{a.title}</b><span className="text-xs text-muted-foreground">{a.body}</span></Link></li>)}</ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-brand" />Ideas por decidir</CardTitle><Link href="/ia/ideas" className="text-xs text-primary hover:underline">Centro de ideas</Link></CardHeader>
          <CardContent>
            {d.ideas.length === 0 ? <EmptyState icon={Lightbulb} title="Sin ideas pendientes" text="Pide ideas a la IA para las próximas fechas y productos prioritarios." action={<Button variant="brand" size="sm" asChild><Link href="/ia/ideas">Generar ideas</Link></Button>} /> : (
              <div className="grid gap-3 sm:grid-cols-3">{d.ideas.map((i) => <Link key={i.id} href={`/ia/debate?idea=${i.id}`} className="rounded-lg border border-border p-3 text-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><b className="line-clamp-2">{i.title}</b><span className="mt-1 block text-xs text-muted-foreground">{i.network} · {i.contentType}</span></Link>)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand" />Resumen semanal con IA</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary ? <div className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{summary}</div> : <p className="text-sm text-muted-foreground">Claude Haiku resume tus datos reales: fechas, tareas, videos y campañas.</p>}
            {aiErr && <p role="alert" className="text-xs text-destructive">{aiErr}</p>}
            <Button variant="soft" size="sm" onClick={askSummary} disabled={busy}>{busy ? "Generando…" : summary ? "Actualizar" : "Generar resumen"}<ArrowRight /></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
