"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Clapperboard, Eye, FileText, Wand2 } from "lucide-react";
import { Button, Dialog, DialogContent, Field, Input } from "@/components/ui/primitives";
import { Md } from "@/components/ui/blocks";
import { callAI } from "@/lib/ai-client";
import { ideaToTask, scheduleIdea } from "@/lib/actions";
import { update, useMe } from "@/lib/store";
import type { Idea } from "@/lib/types";
import { addDays, fmtDate, todayLima } from "@/lib/utils";

export const CHIPS = ["Hazlo más corto", "Más gancho en los primeros 3 segundos", "Más realista, sin efectos", "Enfócalo en conexiones HDPE", "Cierre con invitación a cotizar"];
const ERR = (code: string, msg: string) => (code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY en el servidor)." : msg);
const brief = (i: Idea) => ({ title: i.title, concept: i.concept, script: i.script, duration: i.duration, platform: i.platform });

/** Acciones de una idea: Ver · Mejorar con IA · Crear guion · Programar · Convertir en tarea. */
export function IdeaActions({ idea, compact, onView }: { idea: Idea; compact?: boolean; onView?: () => void }) {
  const { s, me } = useMe();
  const router = useRouter();
  const [mode, setMode] = useState<"" | "improve" | "script" | "schedule">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ script: string; concept?: string; changes?: string } | null>(null);
  const [err, setErr] = useState("");
  const [date, setDate] = useState(idea.date && idea.date >= todayLima() ? idea.date : addDays(todayLima(), 14));
  if (!me) return null;
  const task = s.tasks.find((t) => t.ideaId === idea.id);

  const open = (m: typeof mode) => { setMode(m); setOut(null); setErr(""); setText(""); if (m === "script") runScript(); };
  const runImprove = async (instruction: string) => {
    setText(instruction); setBusy(true); setOut(null); setErr("");
    const r = await callAI<{ script: string; concept: string; changes: string }>(s, "improve", { idea: brief(idea), instruction, fresh: true });
    setBusy(false);
    r.ok ? setOut(r.data) : setErr(ERR(r.code, r.error));
  };
  async function runScript() {
    setBusy(true); setOut(null); setErr("");
    const r = await callAI<{ text: string }>(s, "script", { idea: brief(idea), fresh: true });
    setBusy(false);
    r.ok ? setOut({ script: r.data.text }) : setErr(ERR(r.code, r.error));
  }
  const apply = (note: string) => {
    if (!out) return;
    update((x) => { const i = x.ideas.find((q) => q.id === idea.id)!; i.script = out.script; if (out.concept) i.concept = out.concept; i.versions.push({ v: i.versions.length + 1, at: new Date().toISOString(), note: note.slice(0, 140), script: i.script, concept: i.concept }); }, "Actualizó el guion de una idea");
    toast.success("Guion guardado en la idea"); setMode("");
  };
  const toTask = () => { const id = ideaToTask(idea.id, me.id); toast.success("Convertida en video", { action: { label: "Abrir", onClick: () => router.push(`/videos?tarea=${id}`) } }); };

  const B = ({ icon: Icon, label, short, onClick, variant = "outline", href }: { icon: typeof Eye; label: string; short?: string; onClick?: () => void; variant?: "outline" | "brand" | "soft" | "ghost"; href?: string }) =>
    compact ? (
      <Button size="icon" variant="ghost" title={label} aria-label={label} onClick={onClick} asChild={!!href} className="size-8">{href ? <Link href={href}><Icon /></Link> : <Icon />}</Button>
    ) : (
      <Button size="sm" variant={variant} onClick={onClick} asChild={!!href} title={label} aria-label={label}>{href ? <Link href={href}><Icon />{short ?? label}</Link> : <><Icon />{short ?? label}</>}</Button>
    );

  return (
    <>
      <div className={compact ? "flex items-center gap-0.5" : "flex flex-wrap gap-2"}>
        {onView ? <B icon={Eye} label="Ver idea" short="Ver" onClick={onView} /> : <B icon={Eye} label="Ver idea" short="Ver" href={`/ideas?idea=${idea.id}`} />}
        <B icon={Wand2} label="Mejorar con IA" short="Mejorar" onClick={() => open("improve")} />
        <B icon={FileText} label="Crear guion" short="Guion" onClick={() => open("script")} />
        <B icon={CalendarCheck} label="Programar" onClick={() => { setDate(idea.date && idea.date >= todayLima() ? idea.date : addDays(todayLima(), 14)); open("schedule"); }} />
        {task ? <B icon={Clapperboard} label="Ver video" href={`/videos?tarea=${task.id}`} variant="soft" /> : <B icon={Clapperboard} label="Convertir en tarea" short="Convertir en tarea" onClick={toTask} variant="brand" />}
      </div>

      <Dialog open={mode === "improve" || mode === "script"} onOpenChange={(o) => !o && setMode("")}>
        <DialogContent title={mode === "script" ? "Guion para grabar" : "Mejorar con IA"} description={idea.title} className="max-w-xl">
          <div className="space-y-3">
            {mode === "improve" && <>
              <div className="flex flex-wrap gap-1.5">{CHIPS.map((c) => <button key={c} disabled={busy} onClick={() => runImprove(c)} className="rounded-full border border-border px-2.5 py-1 text-xs transition hover:bg-accent disabled:opacity-50">{c}</button>)}</div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) runImprove(text); }}><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="O escribe tu indicación…" /><Button type="submit" disabled={busy || !text.trim()}>Mejorar</Button></form>
            </>}
            {busy && <p className="animate-pulse text-sm text-muted-foreground">Claude Haiku está escribiendo…</p>}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            {out && <div className="space-y-2">{out.changes && <p className="rounded-lg bg-muted p-3 text-xs"><b>Cambios:</b> {out.changes}</p>}<div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border p-3"><Md text={out.script} /></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode("")}>Cerrar</Button><Button variant="brand" onClick={() => apply(mode === "script" ? "Guion detallado con IA" : `Guion mejorado: ${out.changes ?? ""}`)}>Usar este guion</Button></div></div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "schedule"} onOpenChange={(o) => !o && setMode("")}>
        <DialogContent title="Programar publicación" description={idea.title}>
          <Field label="Fecha de publicación" hint={`Crea el video en “Mis videos” con entrega el ${fmtDate(addDays(date, -1))} y un evento de publicación con recordatorios.`}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode("")}>Cancelar</Button><Button variant="brand" onClick={() => { scheduleIdea(idea.id, date, me.id); toast.success(`Programada para el ${fmtDate(date)}`); setMode(""); }}>Programar</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
