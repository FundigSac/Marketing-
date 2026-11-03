"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GitCompare, Lightbulb, Plug, Sparkles } from "lucide-react";
import { Badge, Button, Card, Select, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, Item, PageHeader, PageSkeleton, Stagger } from "@/components/ui/blocks";
import { IdeaCard } from "@/components/idea-card";
import { generateIdeas } from "@/lib/actions";
import { useMe } from "@/lib/store";
import { can, IDEA_FLOW } from "@/lib/types";
import { todayLima } from "@/lib/utils";

export default function CentroIdeas() {
  const { s, me, ready } = useMe();
  const [busy, setBusy] = useState(false);
  const [prod, setProd] = useState("");
  const [tab, setTab] = useState("activas");
  const [sel, setSel] = useState<string[]>([]);
  const [conf, setConf] = useState<{ configured: boolean; model: string } | null>(null);
  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then(setConf).catch(() => setConf({ configured: false, model: "" })); }, []);
  if (!ready || !me) return <PageSkeleton />;

  const canWrite = can(me.role, "ideas.write");
  const today = todayLima();
  const doneToday = s.ai.lastIdeasDay === today;
  const ideas = s.ideas.filter((i) => (tab === "activas" ? !["descartada", "publicada"].includes(i.status) : tab === "descartadas" ? i.status === "descartada" : i.status === "publicada"));

  const run = async () => {
    setBusy(true);
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay, productId: prod || undefined });
    setBusy(false);
    if (r.ok) toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : " con Claude Haiku"}`); else toast.error(r.error);
  };

  return (
    <>
      <PageHeader title="Centro de ideas" hint={`Entre 3 y 5 propuestas por día (hoy: ${s.prefs.ideasPerDay}). Tú decides cuál avanza.`}
        actions={<>
          <Select aria-label="Producto" value={prod} onChange={(e) => setProd(e.target.value)} className="w-auto"><option value="">Todos los productos</option>{s.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          {canWrite && <Button variant="brand" onClick={run} disabled={busy}><Sparkles />{busy ? "Pensando…" : `Generar ${s.prefs.ideasPerDay} ideas`}</Button>}
        </>} />

      {conf && !conf.configured && (
        <Card className="mb-4 flex items-start gap-3 border-brand/40 bg-brand/5 p-4 text-sm"><Plug className="mt-0.5 size-4 shrink-0 text-brand" /><p><b>La IA (Claude Haiku 5.5) no está conectada.</b> Hasta que se configure <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> en el servidor, las ideas se generan con plantillas locales (marcadas como “Plantilla”).</p></Card>
      )}
      {conf?.configured && <p className="mb-3 text-xs text-muted-foreground">IA conectada · modelo <code>{conf.model}</code></p>}
      {canWrite && !doneToday && <Card className="mb-4 flex items-center justify-between gap-3 border-primary/30 bg-secondary/40 p-4 text-sm"><span>Hoy todavía no se generaron ideas.</span><Button size="sm" onClick={run} disabled={busy}>Generar ahora</Button></Card>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="activas">Activas ({s.ideas.filter((i) => !["descartada", "publicada"].includes(i.status)).length})</TabsTrigger><TabsTrigger value="publicadas">Publicadas</TabsTrigger><TabsTrigger value="descartadas">Descartadas</TabsTrigger></TabsList></Tabs>
        {sel.length >= 2 && <Button asChild variant="outline"><Link href={`/ia/debate?compare=${sel.join(",")}`}><GitCompare />Comparar {sel.length}</Link></Button>}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">{IDEA_FLOW.map((f) => <Badge key={f.id} tone="neutral">{f.label}: {s.ideas.filter((i) => i.status === f.id).length}</Badge>)}</div>

      {ideas.length === 0 ? <EmptyState icon={Lightbulb} title="No hay ideas en esta vista" text="Genera propuestas a partir de tus fechas y productos prioritarios." /> : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((i) => <Item key={i.id}><IdeaCard idea={i} compare={sel.includes(i.id)} onCompare={() => setSel((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id].slice(-4)))} /></Item>)}
        </Stagger>
      )}
    </>
  );
}
