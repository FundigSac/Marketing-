"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Md } from "@/components/ui/blocks";
import { callAI } from "@/lib/ai-client";
import { useStore } from "@/lib/store";

/** Tarjeta reutilizable: pide a Claude Haiku un análisis sobre los datos reales y lo muestra. */
export function AiBox({ title, hint, instruction, button = "Generar con IA", className }: { title: string; hint: string; instruction: string | (() => string); button?: string; className?: string }) {
  const { s } = useStore();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setErr("");
    const r = await callAI<{ text: string }>(s, "summary", { instruction: typeof instruction === "function" ? instruction() : instruction, fresh: true });
    setBusy(false);
    if (r.ok) setText(r.data.text); else setErr(r.code === "IA_NO_CONFIGURADA" ? "La IA no está conectada (falta ANTHROPIC_API_KEY en el servidor)." : r.error);
  };

  return (
    <Card className={className}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand" />{title}</CardTitle><Button size="sm" variant="soft" onClick={run} disabled={busy} className="no-print">{busy ? "Analizando…" : text ? "Actualizar" : button}</Button></CardHeader>
      <CardContent>
        {text ? <Md text={text} /> : <p className="text-sm text-muted-foreground">{hint}</p>}
        {err && <p role="alert" className="mt-2 text-xs text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}
