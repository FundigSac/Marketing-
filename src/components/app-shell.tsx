"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Bell, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, FlaskConical } from "lucide-react";
import { ALL_ITEMS, MOBILE_TABS, NAV } from "@/lib/nav";
import { useMe } from "@/lib/store";
import { update } from "@/lib/store";
import { deriveAlerts } from "@/lib/alerts";
import { todayLima } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/types";
import { Button, Dialog, DialogContent, Select } from "@/components/ui/primitives";
import { CommandPalette } from "@/components/command-palette";
import { remoteEnabled } from "@/lib/sync";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || (path.startsWith(href + "/") && !ALL_ITEMS.some((i) => i.href !== href && i.href.startsWith(href + "/") && path.startsWith(i.href))));

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2" aria-label="Principal">
      {NAV.map((g) => (
        <div key={g.id}>
          {!collapsed ? <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.label}</p> : <div className="mx-3 my-1 h-px bg-border" />}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(path, i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={onNavigate} title={i.label} aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"} ${collapsed ? "justify-center" : ""}`}>
                    {active && <motion.span layoutId={collapsed ? "pill-c" : "pill"} className="absolute inset-0 rounded-md bg-secondary" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <i.icon className="relative size-[18px] shrink-0" />
                    {!collapsed && <span className="relative truncate">{i.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex h-16 items-center gap-3 px-5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-md)]">F</span>
      {!collapsed && <span className="leading-tight"><b className="block text-sm">FUNDIGSAC</b><span className="text-xs text-muted-foreground">Marketing OS</span></span>}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { me, s, ready } = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const [mounted, setMounted] = useState(false);
  const path = usePathname();

  useEffect(() => {
    setMounted(true);
    try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "1"); } catch {}
  }, []);
  useEffect(() => { setMobile(false); }, [path]);

  // Atajos: Ctrl/⌘+K paleta · "/" búsqueda · g luego letra para navegar
  useEffect(() => {
    let g = false, t: ReturnType<typeof setTimeout>;
    const map: Record<string, string> = { d: "/", c: "/calendario", a: "/agenda", i: "/ia/ideas", k: "/produccion/kanban", f: "/produccion/fabrizio", v: "/produccion/videos", p: "/campanas", m: "/metricas", n: "/notificaciones" };
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
      if (g && map[e.key]) { router.push(map[e.key]); g = false; return; }
      if (e.key === "g") { g = true; clearTimeout(t); t = setTimeout(() => (g = false), 900); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  const urgent = alerts.filter((a) => a.level !== "info").length;
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch {} return !c; });

  return (
    <div className="min-h-dvh lg:flex">
      <aside className={`glass sticky top-0 hidden h-dvh shrink-0 flex-col border-y-0 border-l-0 transition-[width] duration-300 lg:flex ${collapsed ? "w-[72px]" : "w-64"}`} style={{ background: "var(--sidebar)" }}>
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        <div className="flex items-center justify-between gap-1 border-t border-border p-3">
          <Button variant="ghost" size="icon" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          {!collapsed && <span className="text-[11px] text-muted-foreground">g + letra: atajos</span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="topbar glass sticky top-0 z-30 flex h-14 items-center gap-2 border-x-0 border-t-0 px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menú"><Menu /></Button>
          <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card/70 px-3 text-left text-sm text-muted-foreground transition hover:bg-card sm:max-w-md">
            <Search className="size-4 shrink-0" /><span className="truncate">Buscar o ir a…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {ready && !remoteEnabled && (
              <span title="Los datos viven solo en este navegador. Conecta Supabase para trabajar en equipo." className="hidden items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand md:flex"><FlaskConical className="size-3.5" />Modo local</span>
            )}
            {ready && (
              <Select aria-label="Usuario activo" value={s.currentUserId} onChange={(e) => update((st) => { st.currentUserId = e.target.value; })} className="h-9 w-auto max-w-36 py-0 text-xs">
                {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
              </Select>
            )}
            <Button variant="ghost" size="icon" asChild aria-label="Notificaciones" className="relative">
              <Link href="/notificaciones"><Bell />{urgent > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">{urgent}</span>}</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
              {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="liquid fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl p-1.5 lg:hidden" aria-label="Navegación móvil">
        {MOBILE_TABS.map((i) => {
          const active = isActive(path, i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] transition ${active ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
              <i.icon className="size-5" /><span className="max-w-full truncate px-1">{i.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent side title="Menú" description="Todas las pantallas" className="max-w-xs p-0">
          <Brand />
          <NavList onNavigate={() => setMobile(false)} />
        </DialogContent>
      </Dialog>
      <CommandPalette open={palette} setOpen={setPalette} />
    </div>
  );
}
