"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bot, Check, GitCompare, Send, User } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { callAI, toIdeaBody } from "@/lib/ai-client";
import { setIdeaStatus } from "@/lib/actions";
import { update, useMe } from "@/lib/store";
import { can, IDEA_FLOW, type Idea, type IdeaBody, type IdeaStatus } from "@/lib/types";
import { uid } from "@/lib/utils";

type Rev = { reply: string; hasRevision: boolean; revised: Parameters<typeof toIdeaBody>[1] };
type Cmp = { summary: string; items: { title: string; advantages: string[]; risks: string[]; resources: string[] }[]; recommendation: string };

function Debate() {
  const q = useSearchParams();
  const router = useRouter();
  const { s, me, ready } = useMe();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<IdeaBody | null>(null);
  const [cmp, setCmp] = useState<Cmp | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ideaId = q.get("idea");
  const compareIds = (q.get("compare") ?? "").split(",").filter(Boolean);
  const idea = s.ideas?.find((i) => i.id === ideaId);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [idea?.messages.length, pending]);
  useEffect(() => {
    if (!ready || compareIds.length < 2) return;
    const list = s.ideas.filter((i) => compareIds.includes(i.id));
    setCmp(null); setErr("");
    callAI<Cmp>(s, "compare", { ideas: list.map((i) => ({ titulo: i.title, producto: i.productId, red: i.network, tipo: i.contentType, objetivo: i.objective, guion: i.script, recursos: i.resources })) }).then((r) => (r.ok ? setCmp(r.data) : setErr(r.error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, q.get("compare")]);

  if (!ready || !me) return <PageSkeleton />;
  const canWrite = can(me.role, "ideas.write");

  const send = async () => {
    if (!idea || !text.trim()) return;
    const msg = text.trim();
    setText(""); setBusy(true); setErr(""); setPending(null);
    update((st) => { const i = st.ideas.find((x) => x.id === idea.id)!; i.messages.push({ id: uid(), role: "user", text: msg, at: new Date().toISOString() }); if (i.status === "propuesta") i.status = "en_debate"; });
    const { id: _i, messages: _m, versions: _v, decisions: _d, status: _s, createdAt: _c, source: _so, eventId: _e, ...body } = idea;
    void [_i, _m, _v, _d, _s, _c, _so, _e];
    const r = await callAI<Rev>(s, "chat", { idea: body, history: idea.messages.slice(-8).map((m) => ({ rol: m.role, texto: m.text })), message: msg });
    setBusy(false);
    if (!r.ok) { setErr(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY en el servidor). Tu mensaje quedó guardado en el historial." : r.error); return; }
    update((st) => { st.ideas.find((x) => x.id === idea.id)!.messages.push({ id: uid(), role: "ia", text: r.data.reply, at: new Date().toISOString() }); });
    if (r.data.hasRevision) setPending(toIdeaBody(s, r.data.revised, idea.productId));
  };

  const applyVersion = () => {
    if (!idea || !pending) return;
    update((st) => { const i = st.ideas.find((x) => x.id === idea.id)!; const v = i.versions.length + 1; Object.assign(i, pending); i.versions.push({ v, at: new Date().toISOString(), body: pending, note: "Versión mejorada tras el debate" }); i.decisions.push({ at: new Date().toISOString(), by: me.id, text: `Aplicó la versión ${v}` }); }, `Aplicó una versión mejorada de "${pending.title}"`);
    setPending(null); toast.success("Versión aplicada");
  };

  const idx = idea ? IDEA_FLOW.findIndex((f) => f.id === idea.status) : -1;
  const next = idx >= 0 && idx < IDEA_FLOW.length - 1 ? IDEA_FLOW[idx + 1] : null;
  const needsAdmin = (st: IdeaStatus) => st === "aprobada" || st === "programada" || st === "publicada";

  if (compareIds.length >= 2) {
    const list = s.ideas.filter((i) => compareIds.includes(i.id));
    return (
      <>
        <PageHeader title="Comparar propuestas" hint="Ventajas, riesgos y recursos de cada idea, con una recomendación. La decisión final es tuya." actions={<Button variant="outline" asChild><Link href="/ia/ideas">Volver a ideas</Link></Button>} />
        {err && <Card className="mb-4 border-destructive/40 p-4 text-sm text-destructive" role="alert">{err}</Card>}
        {!cmp && !err && <p className="text-sm text-muted-foreground">Claude Haiku está comparando…</p>}
        {cmp && (<div className="space-y-4"><Card className="p-5 text-sm">{cmp.summary}</Card>
          <div className="grid gap-4 md:grid-cols-2">{cmp.items.map((it) => <Card key={it.title}><CardHeader><CardTitle>{it.title}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><b className="text-success">Ventajas</b><ul className="list-disc pl-5">{it.advantages.map((a) => <li key={a}>{a}</li>)}</ul></div><div><b className="text-destructive">Riesgos</b><ul className="list-disc pl-5">{it.risks.map((a) => <li key={a}>{a}</li>)}</ul></div><div><b>Recursos</b><ul className="list-disc pl-5">{it.resources.map((a) => <li key={a}>{a}</li>)}</ul></div></CardContent></Card>)}</div>
          <Card className="border-brand/40 bg-brand/5 p-5 text-sm"><b>Recomendación:</b> {cmp.recommendation}</Card></div>)}
        <div className="mt-4 flex flex-wrap gap-2">{list.map((i) => <Button key={i.id} variant="soft" size="sm" onClick={() => router.push(`/ia/debate?idea=${i.id}`)}>Debatir “{i.title.slice(0, 28)}”</Button>)}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Debate de ideas" hint="Conversa con la IA para mejorar, comparar, descartar o aprobar una propuesta." actions={<Button variant="outline" asChild><Link href="/ia/ideas"><GitCompare />Comparar desde el centro</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {s.ideas.filter((i) => i.status !== "descartada").length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aún no hay ideas.</p> : s.ideas.filter((i) => i.status !== "descartada").map((i) => (
            <button key={i.id} onClick={() => router.push(`/ia/debate?idea=${i.id}`)} className={`block w-full rounded-md p-3 text-left text-sm transition hover:bg-accent ${i.id === ideaId ? "bg-secondary" : ""}`}><b className="line-clamp-2">{i.title}</b><span className="text-xs text-muted-foreground">{IDEA_FLOW.find((f) => f.id === i.status)?.label} · v{i.versions.length}</span></button>
          ))}
        </Card>
        {!idea ? <EmptyState icon={Bot} title="Elige una idea" text="Selecciona una propuesta de la lista para abrir el debate." /> : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{idea.title}</h2><Badge tone="primary">{IDEA_FLOW.find((f) => f.id === idea.status)?.label} · versión {idea.versions.length}</Badge></div>
              <ol className="flex flex-wrap gap-1 text-[11px]">{IDEA_FLOW.map((f, k) => <li key={f.id} className={`rounded-full px-2 py-0.5 ${k <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{f.label}</li>)}</ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {canWrite && next && <Button size="sm" disabled={needsAdmin(next.id) && me.role !== "admin"} title={needsAdmin(next.id) && me.role !== "admin" ? "La aprobación final es del administrador" : ""} onClick={() => { setIdeaStatus(idea.id, next.id, me.id, `Pasó a "${next.label}"`); toast.success(`Idea: ${next.label}`); }}><Check />Pasar a “{next.label}”</Button>}
                {canWrite && <Button size="sm" variant="ghost" onClick={() => { setIdeaStatus(idea.id, "descartada", me.id, "Descartada en el debate"); router.push("/ia/ideas"); }}>Descartar</Button>}
              </div>
            </Card>
            <Card className="flex h-[52vh] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {idea.messages.length === 0 && <p className="text-sm text-muted-foreground">Escribe una observación, por ejemplo: “Me gusta, pero que se enfoque más en conexiones HDPE y que el video se vea realista”.</p>}
                {idea.messages.map((m) => (
                  <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role === "ia" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Bot className="size-4" /></span>}
                    <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</p>
                    {m.role === "user" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><User className="size-4" /></span>}
                  </div>
                ))}
                {busy && <p className="text-xs text-muted-foreground">Claude Haiku está escribiendo…</p>}
                <div ref={endRef} />
              </div>
              {err && <p role="alert" className="border-t border-border px-4 py-2 text-xs text-destructive">{err}</p>}
              {pending && (
                <div className="space-y-2 border-t border-border bg-brand/5 p-4 text-sm">
                  <b>Versión mejorada propuesta: {pending.title}</b>
                  <p><span className="text-muted-foreground">Visual:</span> {pending.visual}</p><p className="whitespace-pre-wrap"><span className="text-muted-foreground">Guion:</span> {pending.script}</p>
                  <div className="flex gap-2"><Button size="sm" variant="brand" onClick={applyVersion}>Aplicar versión</Button><Button size="sm" variant="ghost" onClick={() => setPending(null)}>Descartar</Button></div>
                </div>
              )}
              <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu observación…" disabled={!canWrite || busy} aria-label="Mensaje" />
                <Button type="submit" disabled={!canWrite || busy || !text.trim()}><Send />Enviar</Button>
              </form>
            </Card>
            {idea.versions.length > 1 && <Card className="p-4 text-sm"><b>Historial de versiones</b><ul className="mt-2 space-y-1 text-muted-foreground">{idea.versions.map((v) => <li key={v.v}>v{v.v} · {new Date(v.at).toLocaleString("es-PE")} · {v.note}</li>)}</ul></Card>}
          </div>
        )}
      </div>
    </>
  );
}

export default function DebatePage() {
  return <Suspense fallback={<PageSkeleton />}><Debate /></Suspense>;
}
