"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell, FlaskConical, Moon, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Sun } from "lucide-react";
import { NAV } from "@/lib/nav";
import { update, useMe } from "@/lib/store";
import { deriveAlerts } from "@/lib/alerts";
import { generateIdeas } from "@/lib/actions";
import { todayLima } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/types";
import { Button, Select } from "@/components/ui/primitives";
import { CommandPalette } from "@/components/command-palette";
import { AiAssistant } from "@/components/ai-assistant";
import { NotificationsSheet } from "@/components/notifications-sheet";
import { remoteEnabled } from "@/lib/sync";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { me, s, ready } = useMe();
  const [palette, setPalette] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; tab: string }>({ open: false, tab: "avisos" });
  const [mounted, setMounted] = useState(false);
  const [adminTools, setAdminTools] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setMounted(true);
    try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "1"); } catch {}
    // El selector "Ver como" y la etiqueta técnica solo los ve el revisor. Se activan con ?admin=1 (y se recuerdan en este navegador).
    try { if (new URLSearchParams(location.search).get("admin") === "1") localStorage.setItem("studio-admin", "1"); if (new URLSearchParams(location.search).get("admin") === "0") localStorage.removeItem("studio-admin"); setAdminTools(localStorage.getItem("studio-admin") === "1"); } catch {}
  }, []);

  // Atajos: Ctrl/⌘+K paleta · "/" búsqueda · g + letra navega
  useEffect(() => {
    let g = false, t: ReturnType<typeof setTimeout>;
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
      if (g) { const n = NAV.find((x) => x.key === e.key); if (n) router.push(n.href); g = false; return; }
      if (e.key === "g") { g = true; clearTimeout(t); t = setTimeout(() => (g = false), 900); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  // Ideas del día: con IA conectada se piden una vez al día al abrir la app (se desactiva en Ajustes).
  useEffect(() => {
    if (!ready || !me || !s.prefs.autoDaily) return;
    const today = todayLima();
    if (s.ai.lastIdeasDay === today) return;
    const flag = "auto-ideas-" + today;
    try { if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, "1"); } catch {}
    fetch("/api/ai").then((r) => r.json()).then(async (c) => {
      if (!c.configured) return;
      const r = await generateIdeas(s, { count: s.prefs.ideasPerDay, allowFallback: false });
      if (r.ok) toast.success(`${r.n} ideas del día listas`, { action: { label: "Verlas", onClick: () => router.push("/ideas") } });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me?.id]);

  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  const showTools = me?.role === "reviewer" || adminTools;
  const urgent = alerts.filter((a) => a.level !== "info").length;

  return (
    <div className="min-h-dvh lg:flex">
      <aside className={`glass sticky top-0 hidden h-dvh shrink-0 flex-col border-y-0 border-l-0 transition-[width] duration-300 lg:flex ${collapsed ? "w-[68px]" : "w-56"}`} style={{ background: "var(--sidebar)" }}>
        <Link href="/" aria-label="FUNDIGSAC · Inicio" className={`flex h-16 items-center ${collapsed ? "justify-center" : "px-5"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {collapsed ? <img src="/icon-64.png" alt="FUNDIGSAC" className="size-9 rounded-lg" /> : <img src="/logo.png" alt="FUNDIGSAC" className="h-9 w-auto" />}
        </Link>
        <nav className="flex-1 space-y-1 px-2.5 py-3" aria-label="Principal">
          {NAV.map(({ label, href, icon: Icon, key }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined} className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${active ? "font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                {active && <motion.span layoutId="pill" className="absolute inset-0 rounded-lg bg-secondary" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-[18px] shrink-0" />{!collapsed && <span className="relative">{label}</span>}
                {!collapsed && <kbd className="relative ml-auto hidden text-[10px] text-muted-foreground/70 xl:block">g {key}</kbd>}
              </Link>
            );
          })}
        </nav>
        <div className={`flex p-3 ${collapsed ? "justify-center" : "justify-end"}`}>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch {} return !c; })} aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="topbar glass sticky top-0 z-30 flex h-14 items-center gap-2 border-x-0 border-t-0 px-4 lg:px-8">
          <Link href="/" className="lg:hidden" aria-label="Inicio">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon-64.png" alt="FUNDIGSAC" className="size-8 rounded-lg" /></Link>
          <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card/70 px-3 text-left text-sm text-muted-foreground transition hover:bg-card sm:max-w-sm">
            <Search className="size-4 shrink-0" /><span className="truncate">Buscar o ir a…</span><kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {ready && showTools && !remoteEnabled && <span title="Los datos viven solo en este navegador. Conecta Supabase para compartirlos." className="hidden items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand md:flex"><FlaskConical className="size-3.5" />Modo local</span>}
            {ready && showTools && (
              <Select aria-label="Ver como" value={s.currentUserId} onChange={(e) => update((x) => { x.currentUserId = e.target.value; })} className="h-9 w-auto max-w-40 py-0 text-xs">
                {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
              </Select>
            )}
            <Button variant="soft" size="sm" onClick={() => setAiOpen(true)} aria-label="Abrir copiloto de IA" className="gap-1.5"><Sparkles className="text-brand" /><span className="hidden sm:inline">Copiloto</span></Button>
            <Button variant="ghost" size="icon" onClick={() => setSheet({ open: true, tab: "avisos" })} aria-label="Avisos" className="relative"><Bell />{urgent > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">{urgent}</span>}</Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">{mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="liquid fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl p-1.5 lg:hidden" aria-label="Navegación móvil">
        {NAV.map(({ short, href, icon: Icon }) => {
          const active = isActive(path, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] transition ${active ? "bg-secondary text-primary" : "text-muted-foreground"}`}><Icon className="size-5" /><span className="max-w-full truncate px-1">{short}</span></Link>;
        })}
      </nav>

      <CommandPalette open={palette} setOpen={setPalette} onAssistant={() => { setPalette(false); setAiOpen(true); }} />
      <AiAssistant open={aiOpen} onOpenChange={setAiOpen} />
      <NotificationsSheet open={sheet.open} onOpenChange={(o) => setSheet((p) => ({ ...p, open: o }))} tab={sheet.tab} />
    </div>
  );
}
