"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CalendarCheck, ClipboardList } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { AiBox } from "@/components/ai-box";
import { setIdeaStatus } from "@/lib/actions";
import { productName, update, useMe } from "@/lib/store";
import { can, IDEA_FLOW, NETWORKS } from "@/lib/types";
import { fmtDate, uid } from "@/lib/utils";

const ACTIVE = ["elegida", "en_preparacion", "en_revision", "aprobada", "programada", "publicada"] as const;

export default function PlanEditorial() {
  const { s, me, ready } = useMe();
  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "ideas.write");
  const ideas = s.ideas.filter((i) => (ACTIVE as readonly string[]).includes(i.status)).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const groups = new Map<string, typeof ideas>();
  for (const i of ideas) { const k = i.date ? i.date.slice(0, 7) : "sin-fecha"; groups.set(k, [...(groups.get(k) ?? []), i]); }
  const monthLabel = (k: string) => (k === "sin-fecha" ? "Sin fecha asignada" : new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date(k + "-15")));

  const patch = (id: string, p: { date?: string; network?: string; contentType?: string }) => update((st) => { Object.assign(st.ideas.find((i) => i.id === id)!, p); });

  const schedule = (id: string) => {
    const i = s.ideas.find((x) => x.id === id)!;
    if (!i.date) { toast.error("Asigna primero una fecha de publicación."); return; }
    if (i.status !== "aprobada") { toast.error("Solo se programan ideas aprobadas por el administrador."); return; }
    update((st) => {
      st.events.push({ id: uid(), title: `Publicar: ${i.title}`, category: "publicacion", start: i.date!, allDay: true, repeat: "none", reminders: [1, 0], relevance: "alta", source: "manual", ideaIds: [i.id], taskIds: [], contentType: i.contentType, description: `${i.network} · ${i.contentType}` });
    }, `Programó la publicación de "${i.title}"`);
    setIdeaStatus(id, "programada", me.id, `Programada para ${i.date}`);
    toast.success("Publicación programada en el calendario");
  };

  return (
    <>
      <PageHeader title="Plan editorial" hint="Ideas elegidas y aprobadas, ordenadas por fecha, listas para convertir en publicaciones programadas." />
      {ideas.length === 0 ? <EmptyState icon={ClipboardList} title="El plan está vacío" text="Elige ideas en el Centro de ideas. Aquí aparecerán para fecharlas y programarlas." action={<Button asChild><Link href="/ia/ideas">Ir al Centro de ideas</Link></Button>} /> : (
        <div className="space-y-6">
          <AiBox title="Fechas sugeridas por IA" hint="Claude Haiku propone cuándo publicar cada idea según fechas próximas y carga del equipo." button="Sugerir fechas" instruction={() => `Sugiere una fecha concreta (YYYY-MM-DD, desde hoy) y una red para publicar cada una de estas ideas, con el criterio de cada elección: ${JSON.stringify(ideas.map((i) => ({ idea: i.title, estado: i.status, red: i.network, fechaActual: i.date ?? "sin fecha" })))}`} />
          {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => (
            <Card key={k}>
              <CardHeader><CardTitle className="capitalize">{monthLabel(k)}</CardTitle><Badge tone="neutral">{list.length}</Badge></CardHeader>
              <CardContent className="divide-y divide-border">
                {list.map((i) => (
                  <div key={i.id} className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0"><Link href={`/ia/debate?idea=${i.id}`} className="font-medium hover:text-primary">{i.title}</Link><p className="text-xs text-muted-foreground">{productName(s, i.productId) || "Sin producto"} · {i.date ? fmtDate(i.date) : "sin fecha"} <Badge tone="primary" className="ml-1">{IDEA_FLOW.find((f) => f.id === i.status)?.label}</Badge></p></div>
                    {canWrite && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" aria-label="Fecha" className="w-auto" value={i.date ?? ""} onChange={(e) => patch(i.id, { date: e.target.value || undefined })} />
                        <Select aria-label="Red" className="w-auto" value={i.network} onChange={(e) => patch(i.id, { network: e.target.value })}>{[...new Set([i.network, ...NETWORKS])].map((n) => <option key={n}>{n}</option>)}</Select>
                        {i.status === "aprobada" && <Button size="sm" variant="brand" onClick={() => schedule(i.id)}><CalendarCheck />Programar</Button>}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
