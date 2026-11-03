"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Radar, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, Select } from "@/components/ui/primitives";
import { EmptyState, Item, PageHeader, PageSkeleton, Stagger } from "@/components/ui/blocks";
import { callAI } from "@/lib/ai-client";
import { generateIdeas } from "@/lib/actions";
import { upcomingEvents } from "@/lib/domain";
import { update, useMe } from "@/lib/store";
import { can, EVENT_CATEGORIES, type EventItem } from "@/lib/types";
import { fmtDate, todayLima } from "@/lib/utils";

const TONE = { alta: "success", media: "primary", baja: "neutral", descartada: "danger" } as const;

export default function RadarFechas() {
  const { s, me, ready } = useMe();
  const [horizon, setHorizon] = useState(90);
  const [busy, setBusy] = useState("");
  const today = todayLima();
  const list = useMemo(() => (ready ? upcomingEvents(s.events, today, horizon) : []), [s.events, ready, today, horizon]);
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "events.write");

  const setRel = (id: string, relevance: EventItem["relevance"]) => update((st) => { const e = st.events.find((x) => x.id === id); if (e) e.relevance = relevance; }, `Cambió la relevancia de una fecha a "${relevance}"`);

  const evaluate = async () => {
    setBusy("eval");
    const events = list.map(({ e, date }) => ({ title: e.title, date, category: e.category, note: e.relevanceNote }));
    const r = await callAI<{ items: { title: string; relevance: EventItem["relevance"]; note: string; contentAngle: string }[] }>(s, "dates", { events });
    setBusy("");
    if (!r.ok) { toast.error(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY)." : r.error); return; }
    update((st) => {
      for (const it of r.data.items) {
        const e = st.events.find((x) => x.title === it.title && x.relevance !== "descartada");
        if (e) { e.relevance = it.relevance; e.relevanceNote = `${it.note}${it.contentAngle && it.contentAngle !== "ninguno" ? ` Ángulo: ${it.contentAngle}` : ""}`; }
      }
    }, "La IA evaluó la relevancia de las fechas");
    toast.success("Relevancia actualizada por la IA. Puedes corregirla a mano.");
  };

  const ideas = async (e: EventItem) => {
    setBusy(e.id);
    const r = await generateIdeas(s, { count: 3, eventId: e.id });
    setBusy("");
    if (r.ok) toast.success(`${r.n} ideas propuestas para "${e.title}"`, { action: { label: "Ver", onClick: () => (location.href = `/eventos/${e.id}`) } }); else toast.error(r.error);
  };

  return (
    <>
      <PageHeader title="Radar de fechas importantes" hint="Qué se acerca, qué tan relevante es para FUNDIGSAC y qué contenido conviene preparar."
        actions={<><Select aria-label="Horizonte" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-auto"><option value={30}>30 días</option><option value={90}>90 días</option><option value={180}>6 meses</option><option value={365}>1 año</option></Select>{canWrite && <Button variant="brand" onClick={evaluate} disabled={busy === "eval" || !list.length}><Sparkles />{busy === "eval" ? "Evaluando…" : "Evaluar con IA"}</Button>}</>} />
      {list.length === 0 ? <EmptyState icon={Radar} title="No hay fechas en este periodo" text="Agrega fechas desde el calendario o amplía el horizonte." action={<Button asChild><Link href="/eventos/nuevo">Agregar fecha</Link></Button>} /> : (
        <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(({ e, date, in: n }) => (
            <Item key={e.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><Link href={`/eventos/${e.id}`} className="font-semibold hover:text-primary">{e.title}</Link><p className="text-xs text-muted-foreground">{fmtDate(date)} · {EVENT_CATEGORIES[e.category].label}</p></div>
                    <div className="text-right"><b className="block text-2xl leading-none tabular-nums text-primary">{n}</b><span className="text-[11px] text-muted-foreground">{n === 1 ? "día" : "días"}</span></div>
                  </div>
                  <p className="text-sm text-muted-foreground">{e.relevanceNote || "Sin explicación de relevancia todavía."}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[e.relevance]}>Relevancia {e.relevance}</Badge>
                    {canWrite && <Select aria-label="Cambiar relevancia" value={e.relevance} onChange={(x) => setRel(e.id, x.target.value as EventItem["relevance"])} className="h-7 w-auto py-0 text-xs"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option><option value="descartada">Descartar</option></Select>}
                    {canWrite && e.relevance !== "baja" && <Button size="sm" variant="soft" className="ml-auto" onClick={() => ideas(e)} disabled={busy === e.id}><Sparkles />{busy === e.id ? "…" : "Ideas"}</Button>}
                  </div>
                </CardContent>
              </Card>
            </Item>
          ))}
        </Stagger>
      )}
    </>
  );
}
