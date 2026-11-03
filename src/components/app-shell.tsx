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
import { localNotify } from "@/lib/notify";
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
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
      // El selector "Ver como" y la etiqueta técnica solo los ve el revisor. Se activan con ?admin=1 (y se recuerdan en este navegador).
      const q = new URLSearchParams(location.search).get("admin");
      if (q === "1") localStorage.setItem("studio-admin", "1");
      if (q === "0") localStorage.removeItem("studio-admin");
      setAdminTools(localStorage.getItem("studio-admin") === "1");
    } catch {}
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
      if (r.ok) { localNotify(`${r.n} ideas nuevas para hoy`, "Ya están listas en Ideas con IA.", "/ideas"); toast.success(`${r.n} ideas del día listas`, { action: { label: "Verlas", onClick: () => router.push("/ideas") } }); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me?.id]);

  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  const showTools = me?.role === "reviewer" || adminTools;
  const urgent = alerts.filter((a) => a.level !== "info").length;
  const W = collapsed ? 64 : 224;

  return (
    <div className="min-h-dvh">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex" style={{ width: W }} aria-label="Barra lateral">
        <Link href="/" aria-label="FUNDIGSAC · Inicio" className={`flex h-14 shrink-0 items-center border-b border-border ${collapsed ? "justify-center" : "px-4"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {collapsed ? <img src="/icon-64.png" alt="FUNDIGSAC" className="size-8 rounded-lg" /> : <img src="/logo.png" alt="FUNDIGSAC" className="h-8 w-auto" />}
        </Link>
        <nav className="flex-1 space-y-0.5 p-2.5" aria-label="Principal">
          {NAV.map(({ label, href, icon: Icon, key }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined} className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${active ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-secondary" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
                <Icon className="relative size-[18px] shrink-0" />
                {!collapsed && <span className="relative">{label}</span>}
                {!collapsed && <kbd className="relative ml-auto hidden text-[10px] font-normal text-muted-foreground/60 xl:block">g {key}</kbd>}
              </Link>
            );
          })}
        </nav>
        <div className={`flex shrink-0 border-t border-border p-2.5 ${collapsed ? "justify-center" : "justify-end"}`}>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch {} return !c; })} aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
        </div>
      </aside>

      <div style={{ "--rail": `${W}px` } as React.CSSProperties} className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 lg:pl-[var(--rail)]">
        <header className="topbar sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
          <Link href="/" className="lg:hidden" aria-label="Inicio">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon-64.png" alt="FUNDIGSAC" className="size-8 rounded-lg" /></Link>
          <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground transition-colors hover:border-input sm:max-w-xs">
            <Search className="size-4 shrink-0" /><span className="truncate">Buscar…</span><kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {ready && showTools && !remoteEnabled && <span title="Los datos viven solo en este navegador. Conecta Supabase para compartirlos." className="hidden items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground md:flex"><FlaskConical className="size-3.5" />Modo local</span>}
            {ready && showTools && (
              <Select aria-label="Ver como" value={s.currentUserId} onChange={(e) => update((x) => { x.currentUserId = e.target.value; })} className="h-9 w-auto max-w-40 py-0 text-xs">
                {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} aria-label="Abrir copiloto de IA" className="gap-1.5"><Sparkles className="text-brand" /><span className="hidden sm:inline">Copiloto</span></Button>
            <Button variant="ghost" size="icon" onClick={() => setSheet({ open: true, tab: "avisos" })} aria-label="Avisos" className="relative">
              <Bell />
              {urgent > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">{urgent}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">{mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-12"><motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div></main>
      </div>

      {/* Navegación inferior (móvil / tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación móvil">
        {NAV.map(({ short, href, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              {active && <motion.span layoutId="tab-active" className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-primary" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
              <Icon className="size-5" />{short}
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={palette} setOpen={setPalette} onAssistant={() => { setPalette(false); setAiOpen(true); }} />
      <AiAssistant open={aiOpen} onOpenChange={setAiOpen} />
      <NotificationsSheet open={sheet.open} onOpenChange={(o) => setSheet((p) => ({ ...p, open: o }))} tab={sheet.tab} />
    </div>
  );
}
