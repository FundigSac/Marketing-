"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { CalendarPlus, ClipboardPlus, Lightbulb, Moon, Search, Sparkles } from "lucide-react";
import { NAV } from "@/lib/nav";
import { useStore } from "@/lib/store";

const item = "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent";
const group = "px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5";

export function CommandPalette({ open, setOpen, onAssistant }: { open: boolean; setOpen: (o: boolean) => void; onAssistant: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { s, ready } = useStore();
  const [q, setQ] = useState("");
  useEffect(() => { if (!open) setQ(""); }, [open]);
  const go = (href: string) => { setOpen(false); router.push(href); };
  const hit = (txt: string) => q.length > 1 && txt.toLowerCase().includes(q.toLowerCase());
  const f = (l: string) => !q || l.toLowerCase().includes(q.toLowerCase());

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Paleta de comandos" shouldFilter={false} className="fixed inset-0 z-[60] grid place-items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-[2px]">
      <div className="liquid w-full max-w-xl overflow-hidden rounded-2xl text-foreground animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Command.Input value={q} onValueChange={setQ} placeholder="Buscar ideas, videos o fechas…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados.</Command.Empty>
          <Command.Group heading="Crear" className={group}>
            {[
              { l: "Pedir ideas de video a la IA", i: Lightbulb, f: () => go("/ideas?generar=1") },
              { l: "Nuevo video", i: ClipboardPlus, f: () => go("/videos?nueva=1") },
              { l: "Nuevo evento en el calendario", i: CalendarPlus, f: () => go("/calendario?nuevo=1") },
              { l: "Abrir el copiloto de IA", i: Sparkles, f: onAssistant },
              { l: "Cambiar tema claro/oscuro", i: Moon, f: () => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); } },
            ].filter((a) => f(a.l)).map((a) => <Command.Item key={a.l} onSelect={a.f} className={item}><a.i className="size-4 text-brand" />{a.l}</Command.Item>)}
          </Command.Group>
          <Command.Group heading="Ir a" className={group}>
            {NAV.filter((n) => f(n.label)).map((n) => <Command.Item key={n.href} onSelect={() => go(n.href)} className={item}><n.icon className="size-4 text-primary" />{n.label}<span className="ml-auto text-xs text-muted-foreground">g {n.key}</span></Command.Item>)}
          </Command.Group>
          {ready && q.length > 1 && (
            <Command.Group heading="Resultados" className={group}>
              {s.events.filter((e) => hit(e.title)).slice(0, 4).map((e) => <Command.Item key={e.id} onSelect={() => go("/calendario")} className={item}>📅 {e.title}</Command.Item>)}
              {s.ideas.filter((i) => hit(i.title)).slice(0, 5).map((i) => <Command.Item key={i.id} onSelect={() => go(`/ideas?idea=${i.id}`)} className={item}>💡 {i.title}</Command.Item>)}
              {s.tasks.filter((t) => hit(t.title)).slice(0, 5).map((t) => <Command.Item key={t.id} onSelect={() => go(`/videos?tarea=${t.id}`)} className={item}>🎬 {t.title}</Command.Item>)}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
