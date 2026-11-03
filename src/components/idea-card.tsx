"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, MessagesSquare, Users } from "lucide-react";
import { Badge, Button, Card, Dialog, DialogContent, Field, Select } from "@/components/ui/primitives";
import { createTasksFromIdea, setIdeaStatus } from "@/lib/actions";
import { productName, useMe } from "@/lib/store";
import { can, IDEA_FLOW, type Idea } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

const PRIO = { alta: "danger", media: "warning", baja: "neutral" } as const;

export function IdeaCard({ idea, compare, onCompare }: { idea: Idea; compare?: boolean; onCompare?: () => void }) {
  const { s, me } = useMe();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  if (!me) return null;
  const canWrite = can(me.role, "ideas.write");
  const label = IDEA_FLOW.find((f) => f.id === idea.status)?.label ?? "Descartada";

  return (
    <Card className="flex h-full flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="primary">{label}</Badge>
          <Badge tone={PRIO[idea.priority]}>Prioridad {idea.priority}</Badge>
          <Badge tone="neutral">{idea.source === "ia" ? <><Bot className="size-3" />Claude Haiku</> : idea.source === "plantilla" ? "Plantilla" : "Manual"}</Badge>
        </div>
        {onCompare && <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={!!compare} onChange={onCompare} />Comparar</label>}
      </div>
      <h3 className="text-base font-semibold leading-snug">{idea.title}</h3>
      <p className="text-xs text-muted-foreground">{[productName(s, idea.productId), idea.network, idea.contentType, idea.date && fmtDate(idea.date)].filter(Boolean).join(" · ")}</p>
      <dl className="space-y-2 text-sm">
        <div><dt className="text-xs font-medium text-muted-foreground">Objetivo comercial</dt><dd>{idea.objective}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Concepto visual</dt><dd>{idea.visual}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Guion / mensaje</dt><dd className="whitespace-pre-wrap">{idea.script}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Recursos</dt><dd>{idea.resources}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Por qué podría funcionar</dt><dd>{idea.why}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" asChild><Link href={`/ia/debate?idea=${idea.id}`}><MessagesSquare />Debatir</Link></Button>
        {canWrite && idea.status === "propuesta" && <Button size="sm" onClick={() => { setIdeaStatus(idea.id, "elegida", me.id, "Elegida por el equipo"); toast.success("Idea elegida"); }}>Elegir</Button>}
        {canWrite && ["elegida", "en_debate"].includes(idea.status) && <Button size="sm" variant="brand" onClick={() => setOpen(true)}><Users />Asignar tareas</Button>}
        {canWrite && !["descartada", "publicada"].includes(idea.status) && <Button size="sm" variant="ghost" onClick={() => setIdeaStatus(idea.id, "descartada", me.id, "Descartada")}>Descartar</Button>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Asignar al equipo" description="Se crean 3 tareas: guion y recursos, producción y revisión, con fechas escalonadas.">
          <Field label="Responsable"><Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Sin asignar</option>{s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="brand" onClick={() => { createTasksFromIdea(idea.id, who || undefined, me.id); setOpen(false); toast.success("Tareas creadas en el Kanban"); }}>Crear tareas</Button></div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
