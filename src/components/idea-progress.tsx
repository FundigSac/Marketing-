"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { taskProgress } from "@/lib/domain";
import { COLUMNS, type Task } from "@/lib/types";

/** Mini kanban de una idea elegida: muestra en qué etapa va su video y cuánto falta. */
export function IdeaProgress({ task }: { task: Task }) {
  const at = COLUMNS.findIndex((c) => c.id === task.status);
  const pct = taskProgress(task);
  return (
    <Link href={`/videos?tarea=${task.id}`} aria-label={`Avance del video: ${COLUMNS[at].label}, ${pct}%`} className="group block rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted">
      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">Avance del video</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">{task.changes && <Badge tone="brand">Correcciones</Badge>}<span className="tabular-nums text-foreground">{pct}%</span></span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {COLUMNS.map((c, i) => {
          const done = i < at || (task.status === "publicado" && i === at), current = i === at && !done;
          return (
            <li key={c.id} className="min-w-0">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-border">
                <motion.span className={`absolute inset-y-0 left-0 rounded-full ${current ? "bg-brand" : "bg-primary"}`} initial={{ width: 0 }} animate={{ width: done ? "100%" : current ? "55%" : 0 }} transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <span className={`mt-1.5 flex items-center gap-1 truncate text-[11px] leading-tight ${current ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{done && <Check className="size-3 shrink-0" />}<span className="truncate">{c.label}</span></span>
            </li>
          );
        })}
      </ol>
    </Link>
  );
}
