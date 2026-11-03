"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";
import { Button, Dialog, DialogContent, Input } from "@/components/ui/primitives";
import { Md } from "@/components/ui/blocks";
import { callAI } from "@/lib/ai-client";
import { useStore } from "@/lib/store";

type Msg = { role: "user" | "ia"; text: string; error?: boolean };
let history: Msg[] = []; // se conserva mientras navegas por el sitio

// Capacidades del asistente (instrucciones fijas; los datos salen del contexto real de la app).
const QUICK: { label: string; ask: string }[] = [
  { label: "Resumen semanal", ask: "Elabora un resumen semanal de marketing: fechas próximas, avance del equipo, tareas atrasadas, videos pendientes, campañas y consultas." },
  { label: "Prioridades de hoy", ask: "Recomienda las 5 prioridades para hoy y esta semana, ordenadas, con el motivo de cada una." },
  { label: "Tareas vencidas", ask: "Identifica las tareas y entregables vencidos o por vencer, quién los tiene y qué acción concreta recomiendas." },
  { label: "Avance de Fabrizio", ask: "Resume el avance de Fabrizio: qué desarrolla, qué debe entregar, videos pendientes, correcciones y atrasos." },
  { label: "Comparar campañas", ask: "Compara las campañas con resultados registrados (costos, mensajes, cotizaciones, ventas) y dime cuál rinde mejor y qué datos faltan." },
  { label: "Fechas de publicación", ask: "Sugiere fechas concretas para publicar según las fechas próximas, las ideas y la carga de trabajo. Explica el criterio." },
  { label: "Datos de productos", ask: "Revisa la información de productos cargada: qué especificaciones, fotos o disponibilidad faltan por confirmar antes de promocionarlos." },
];

export function AiAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { s } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>(history);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next); history = next; setText(""); setBusy(true);
    const prior = next.slice(-7, -1).map((m) => `${m.role === "user" ? "Equipo" : "Asistente"}: ${m.text.slice(0, 600)}`).join("\n");
    const r = await callAI<{ text: string }>(s, "summary", { instruction: `${prior ? `Conversación previa:\n${prior}\n\n` : ""}Pregunta actual del equipo: ${q}`, fresh: true });
    const reply: Msg = r.ok ? { role: "ia", text: r.data.text } : { role: "ia", error: true, text: r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada: falta ANTHROPIC_API_KEY en el servidor." : r.error };
    const all = [...next, reply];
    setMsgs(all); history = all; setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side title="Asistente de marketing" description="Claude Haiku 5.5 con los datos reales de la app. No inventa cifras: si falta un dato, lo dice." className="max-w-xl overflow-hidden">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => <button key={q.label} disabled={busy} onClick={() => ask(q.ask)} className="rounded-full border border-border bg-card px-3 py-1 text-xs transition hover:bg-accent disabled:opacity-50"><Sparkles className="mr-1 inline size-3 text-brand" />{q.label}</button>)}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-3">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">Elige una acción rápida o escribe tu pregunta. Puedo resumir avances, detectar atrasos, recomendar prioridades, comparar campañas, sugerir fechas y revisar los datos de productos.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ia" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Bot className="size-4" /></span>}
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{m.role === "ia" && !m.error ? <Md text={m.text} /> : <p className="text-sm">{m.text}</p>}</div>
              {m.role === "user" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><User className="size-4" /></span>}
            </div>
          ))}
          {busy && <p className="animate-pulse text-xs text-muted-foreground">Claude Haiku está pensando…</p>}
          <div ref={end} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Pregunta sobre tu marketing…" disabled={busy} aria-label="Pregunta" />
          <Button type="submit" disabled={busy || !text.trim()}><Send />Enviar</Button>
          {msgs.length > 0 && <Button type="button" variant="ghost" size="icon" aria-label="Limpiar conversación" onClick={() => { setMsgs([]); history = []; }}><Trash2 /></Button>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
