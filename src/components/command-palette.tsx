"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { CalendarPlus, ClipboardPlus, Lightbulb, Moon, Search } from "lucide-react";
import { ALL_ITEMS } from "@/lib/nav";
import { useStore } from "@/lib/store";

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { s, ready } = useStore();
  const [q, setQ] = useState("");
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const hit = (txt: string) => q.length > 1 && txt.toLowerCase().includes(q.toLowerCase());

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Paleta de comandos" shouldFilter={false}
      className="fixed inset-0 z-[60] grid place-items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      overlayClassName="">
      <div className="liquid w-full max-w-xl overflow-hidden rounded-2xl text-foreground animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Command.Input value={q} onValueChange={setQ} placeholder="Buscar pantallas, eventos, tareas, ideas…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados.</Command.Empty>
          <Command.Group heading="Acciones" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {[
              { l: "Crear evento", i: CalendarPlus, f: () => go("/eventos/nuevo") },
              { l: "Nueva tarea en el Kanban", i: ClipboardPlus, f: () => go("/produccion/kanban?nueva=1") },
              { l: "Pedir ideas a la IA", i: Lightbulb, f: () => go("/ia/ideas") },
              { l: "Cambiar tema claro/oscuro", i: Moon, f: () => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); } },
            ].filter((a) => !q || a.l.toLowerCase().includes(q.toLowerCase())).map((a) => (
              <Command.Item key={a.l} onSelect={a.f} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">
                <a.i className="size-4 text-brand" />{a.l}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Ir a" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {ALL_ITEMS.filter((i) => !q || (i.label + i.group).toLowerCase().includes(q.toLowerCase())).map((i) => (
              <Command.Item key={i.href} onSelect={() => go(i.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">
                <i.icon className="size-4 text-primary" />{i.label}<span className="ml-auto text-xs text-muted-foreground">{i.group}</span>
              </Command.Item>
            ))}
          </Command.Group>
          {ready && q.length > 1 && (
            <Command.Group heading="Resultados" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {s.events.filter((e) => hit(e.title)).slice(0, 5).map((e) => <Command.Item key={e.id} onSelect={() => go(`/eventos/${e.id}`)} className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">📅 {e.title}</Command.Item>)}
              {s.tasks.filter((t) => hit(t.title)).slice(0, 5).map((t) => <Command.Item key={t.id} onSelect={() => go(`/produccion/tareas/${t.id}`)} className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">✅ {t.title}</Command.Item>)}
              {s.ideas.filter((i) => hit(i.title)).slice(0, 5).map((i) => <Command.Item key={i.id} onSelect={() => go(`/ia/debate?idea=${i.id}`)} className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">💡 {i.title}</Command.Item>)}
              {s.products.filter((p) => hit(p.name)).slice(0, 4).map((p) => <Command.Item key={p.id} onSelect={() => go("/campanas/productos")} className="cursor-pointer rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent">📦 {p.name}</Command.Item>)}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
