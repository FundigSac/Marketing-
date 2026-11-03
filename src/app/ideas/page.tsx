"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bot, Clock, Heart, MessagesSquare, Plug, Repeat2, Send, Sparkles, User, X } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Input, MenuItem } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton, Seg } from "@/components/ui/blocks";
import { CHIPS, IdeaActions } from "@/components/idea-actions";
import { IdeaProgress } from "@/components/idea-progress";
import { callAI, toIdea, type AiIdea } from "@/lib/ai-client";
import { generateIdeas, saveIdeas } from "@/lib/actions";
import { productName, update, useMe } from "@/lib/store";
import type { Idea } from "@/lib/types";
import { fmtDate, todayLima, uid } from "@/lib/utils";

type Rev = { reply: string; hasRevision: boolean; revised: AiIdea };

function Tile({ idea, hl, onDebate, onAlt, altBusy }: { idea: Idea; hl: boolean; onDebate: () => void; onAlt: () => void; altBusy: boolean }) {
  const { s } = useMe();
  const [open, setOpen] = useState(hl);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (hl) { setOpen(true); ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }, [hl]);
  const set = (fn: (i: Idea) => void, log?: string) => update((x) => { fn(x.ideas.find((q) => q.id === idea.id)!); }, log);
  const pname = productName(s, idea.productId) || idea.productName;
  const task = s.tasks.find((t) => t.ideaId === idea.id);
  // Una escena por párrafo: separa por línea en blanco o, si el guion viene corrido, por salto de línea.
  const blocks = idea.script.split(/\n\s*\n/);
  const scenes = (blocks.length > 1 ? blocks : idea.script.split("\n")).map((b) => b.trim()).filter(Boolean);
  return (
    <motion.div ref={ref} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
      <article className={`flex flex-col gap-4 border-b border-border py-8 first:pt-4 ${hl ? "-mx-4 rounded-2xl bg-brand/[0.06] px-4" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {idea.status === "en_produccion" && <Badge tone="success">En producción</Badge>}
            <Badge>{idea.source === "ia" ? <><Bot className="size-3" />Claude Haiku</> : "Plantilla"}</Badge>
            {idea.versions.length > 1 && <Badge>v{idea.versions.length}</Badge>}
            {idea.date && <Badge tone="primary">{fmtDate(idea.date)}</Badge>}
          </div>
          <button aria-label={idea.favorite ? "Quitar de favoritas" : "Guardar como favorita"} aria-pressed={idea.favorite} onClick={() => set((i) => { i.favorite = !i.favorite; })} className={`-mr-1 rounded-md p-1 transition active:scale-90 ${idea.favorite ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}><Heart className={`size-5 ${idea.favorite ? "fill-current" : ""}`} /></button>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-snug tracking-tight">{idea.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{idea.concept}</p>
        </div>
        <div className="flex flex-wrap gap-1.5"><Badge tone="primary">{pname || "Producto por definir"}</Badge><Badge><Clock className="size-3" />{idea.duration}</Badge><Badge>{idea.platform}</Badge></div>
        {open && <div className="space-y-3 rounded-lg bg-muted p-4 text-sm leading-relaxed">{scenes.map((p, k) => <p key={k}>{p}</p>)}</div>}
        {idea.why && <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Por qué funciona:</span> {idea.why}</p>}
        {task && <IdeaProgress task={task} />}
        <div className="pt-1">
          <IdeaActions idea={idea} onView={() => setOpen((o) => !o)} extra={<>
            <MenuItem icon={MessagesSquare} onClick={onDebate}>Conversar con la IA</MenuItem>
            <MenuItem icon={Repeat2} onClick={onAlt}>{altBusy ? "Buscando alternativas…" : "Pedir alternativas"}</MenuItem>
            {idea.status !== "en_produccion" && <MenuItem icon={X} danger onClick={() => set((i) => { i.status = "descartada"; }, `Descartó la idea "${idea.title}"`)}>Descartar</MenuItem>}
          </>} />
        </div>
      </article>
    </motion.div>
  );
}

function Ideas() {
  const { s, me, ready } = useMe();
  const q = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState("hoy");
  const [busy, setBusy] = useState("");
  const [conf, setConf] = useState<{ configured: boolean; model: string } | null>(null);
  const [debate, setDebate] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [pending, setPending] = useState<AiIdea | null>(null);
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const hlId = q.get("idea");

  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then(setConf).catch(() => setConf({ configured: false, model: "" })); }, []);
  useEffect(() => { if (hlId) setTab("todas"); }, [hlId]);
  const di = s.ideas?.find((i) => i.id === debate);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [di?.messages.length, pending, chatBusy]);

  const gen = async () => {
    setBusy("gen");
    const r = await generateIdeas(s, { count: s.prefs.ideasPerDay });
    setBusy("");
    r.ok ? toast.success(`${r.n} ideas nuevas${r.note ? ` · ${r.note}` : " con Claude Haiku"}`) : toast.error(r.error);
  };
  const alternatives = async (idea: Idea) => {
    setBusy(idea.id);
    const r = await callAI<{ ideas: AiIdea[] }>(s, "ideas", { count: 3, avoid: idea.title, eventTitle: idea.eventId ? s.events.find((e) => e.id === idea.eventId)?.title : undefined, fresh: true });
    setBusy("");
    if (r.ok) { const n = saveIdeas(r.data.ideas.map((a) => toIdea(s, a, "ia", idea.eventId, todayLima()))); toast.success(`${n} alternativas nuevas`); setTab("hoy"); }
    else toast.error(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada: no puedo proponer alternativas reales." : r.error);
  };
  useEffect(() => {
    if (!ready || started.current || q.get("generar") !== "1") return;
    started.current = true; router.replace("/ideas"); gen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready || !me) return <PageSkeleton />;
  const today = todayLima();
  const all = s.ideas.filter((i) => i.status !== "descartada");
  const list = tab === "hoy" ? all.filter((i) => i.batch === today || i.createdAt.slice(0, 10) === today) : tab === "fav" ? all.filter((i) => i.favorite) : all;

  const send = async (text: string) => {
    if (!di || !text.trim()) return;
    setMsg(""); setChatBusy(true); setChatErr(""); setPending(null);
    update((x) => { x.ideas.find((i) => i.id === di.id)!.messages.push({ id: uid(), role: "user", text: text.trim(), at: new Date().toISOString() }); });
    const r = await callAI<Rev>(s, "chat", { idea: { title: di.title, concept: di.concept, script: di.script, productName: productName(s, di.productId) || di.productName, duration: di.duration, platform: di.platform, why: di.why }, history: di.messages.slice(-8).map((m) => ({ rol: m.role, texto: m.text })), message: text.trim() });
    setChatBusy(false);
    if (!r.ok) { setChatErr(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY). Tu mensaje quedó guardado." : r.error); return; }
    update((x) => { x.ideas.find((i) => i.id === di.id)!.messages.push({ id: uid(), role: "ia", text: r.data.reply, at: new Date().toISOString() }); });
    if (r.data.hasRevision) setPending(r.data.revised);
  };
  const applyRevision = () => {
    if (!di || !pending) return;
    update((x) => { const i = x.ideas.find((q2) => q2.id === di.id)!; Object.assign(i, { title: pending.title, concept: pending.concept, script: pending.script, duration: pending.duration, platform: pending.platform, why: pending.why }); i.versions.push({ v: i.versions.length + 1, at: new Date().toISOString(), note: "Versión mejorada en la conversación", script: pending.script, concept: pending.concept }); }, `Aplicó una versión mejorada de "${pending.title}"`);
    setPending(null); toast.success("Versión aplicada");
  };

  return (
    <>
      <PageHeader title="Ideas con IA" hint={`${s.prefs.ideasPerDay} ideas de video por día según tus fechas, productos HDPE y lo que ya publicaste. No se repiten.`}
        actions={<Button variant="brand" onClick={gen} disabled={busy === "gen"}><Sparkles />{busy === "gen" ? "Pensando…" : `Pedir ${s.prefs.ideasPerDay} ideas nuevas`}</Button>} />
      {conf && !conf.configured && <Card className="mb-3 flex items-start gap-3 border-brand/40 bg-brand/5 p-3 text-sm"><Plug className="mt-0.5 size-4 shrink-0 text-brand" /><p><b>La IA no está conectada.</b> Configura <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> para ideas reales con Claude Haiku. Mientras tanto salen plantillas marcadas como “Plantilla”.</p></Card>}
      <p className="mb-3 text-xs text-muted-foreground"><Plug className="mr-1.5 inline size-3.5 align-text-bottom" />Fuentes de tendencias: <b className="text-foreground">no conectadas</b>. Las ideas no afirman tendencias; se basan en fechas, productos y tus publicaciones.{conf?.configured && <span className="ml-2">· IA: {conf.model}</span>}</p>
      <div className="mb-4"><Seg id="ideas" value={tab} onChange={setTab} items={[{ id: "hoy", label: "Hoy" }, { id: "fav", label: `Favoritas (${all.filter((i) => i.favorite).length})` }, { id: "todas", label: `Todas (${all.length})` }]} /></div>
      {list.length === 0 ? <EmptyState icon={Sparkles} title={tab === "hoy" ? "Hoy aún no hay ideas" : "Nada por aquí todavía"} text="Pide ideas a la IA o guarda tus favoritas con el corazón." action={<Button variant="brand" onClick={gen} disabled={busy === "gen"}>Pedir ideas</Button>} /> : (
        <div>{list.map((i) => <Tile key={i.id} idea={i} hl={hlId === i.id} altBusy={busy === i.id} onDebate={() => { setDebate(i.id); setPending(null); setChatErr(""); }} onAlt={() => alternatives(i)} />)}</div>
      )}

      <Dialog open={!!di} onOpenChange={(o) => !o && setDebate(null)}>
        <DialogContent side title="Conversar con la IA" description={di?.title} className="max-w-lg overflow-hidden">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-3">
            {di && di.messages.length === 0 && <p className="text-sm text-muted-foreground">Cuéntale qué cambiarías. Ej.: “Me gusta, pero que se enfoque en conexiones HDPE y que el video se vea realista”.</p>}
            {di?.messages.map((m) => <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>{m.role === "ia" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Bot className="size-4" /></span>}<p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</p>{m.role === "user" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><User className="size-4" /></span>}</div>)}
            {chatBusy && <p className="animate-pulse text-xs text-muted-foreground">Claude Haiku está pensando…</p>}
            {pending && <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm"><b>Versión propuesta: {pending.title}</b><p>{pending.concept}</p><pre className="whitespace-pre-wrap font-sans text-xs">{pending.script}</pre><div className="flex gap-2"><Button size="sm" variant="brand" onClick={applyRevision}>Aplicar versión</Button><Button size="sm" variant="ghost" onClick={() => setPending(null)}>Descartar</Button></div></div>}
            <div ref={end} />
          </div>
          {chatErr && <p role="alert" className="text-xs text-destructive">{chatErr}</p>}
          <div className="flex flex-wrap gap-1.5">{CHIPS.map((c) => <button key={c} disabled={chatBusy} onClick={() => send(c)} className="rounded-full border border-border px-2.5 py-1 text-xs transition hover:bg-accent disabled:opacity-50">{c}</button>)}</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(msg); }}><Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escribe tu observación…" aria-label="Mensaje" disabled={chatBusy} /><Button type="submit" disabled={chatBusy || !msg.trim()}><Send />Enviar</Button></form>
          {di && di.versions.length > 1 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Historial de versiones ({di.versions.length})</summary><ul className="mt-1 space-y-1">{di.versions.map((v) => <li key={v.v} className="flex items-center justify-between gap-2"><span>v{v.v} · {v.note}</span><button className="text-primary hover:underline" onClick={() => update((x) => { const i = x.ideas.find((q2) => q2.id === di.id)!; i.script = v.script; i.concept = v.concept; })}>Restaurar</button></li>)}</ul></details>}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function IdeasPage() { return <Suspense fallback={<PageSkeleton />}><Ideas /></Suspense>; }
