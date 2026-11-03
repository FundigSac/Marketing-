"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
const spring = { type: "spring", stiffness: 520, damping: 40 } as const;

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
  const [hover, setHover] = useState<string | null>(null);

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
      if (r.ok) toast.success(`${r.n} ideas del día listas`, { action: { label: "Verlas", onClick: () => router.push("/ideas") } });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me?.id]);

  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  const showTools = me?.role === "reviewer" || adminTools;
  const urgent = alerts.filter((a) => a.level !== "info").length;
  const W = collapsed ? 76 : 224;

  return (
    <div className="min-h-dvh">
      {/* Rail flotante (escritorio) */}
      <motion.aside initial={false} animate={{ width: W }} transition={spring} className="glass fixed bottom-3 left-3 top-3 z-30 hidden flex-col rounded-3xl shadow-[var(--shadow-lg)] lg:flex" style={{ background: "var(--sidebar)" }} aria-label="Barra lateral">
        <Link href="/" aria-label="FUNDIGSAC · Inicio" className={`relative flex h-[72px] items-center ${collapsed ? "justify-center" : "px-5"}`}>
          <span aria-hidden className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {collapsed ? <img src="/icon-64.png" alt="FUNDIGSAC" className="relative size-10 rounded-xl shadow-[var(--shadow-md)]" /> : <img src="/logo.png" alt="FUNDIGSAC" className="relative h-10 w-auto drop-shadow-[0_4px_14px_rgba(79,140,255,0.35)]" />}
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Principal" onMouseLeave={() => setHover(null)}>
          {NAV.map(({ label, href, icon: Icon, key }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined} onMouseEnter={() => setHover(href)} onFocus={() => setHover(href)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${active ? "font-semibold text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {hover === href && !active && <motion.span layoutId="hover" className="absolute inset-0 rounded-xl bg-accent" transition={spring} />}
                {active && <motion.span layoutId="pill" className="absolute inset-0 rounded-xl bg-[image:var(--grad-primary)] shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--primary)_85%,transparent)]" transition={spring} />}
                <Icon className="relative size-[18px] shrink-0" />
                {!collapsed && <span className="relative">{label}</span>}
                {!collapsed && <kbd className={`relative ml-auto hidden rounded px-1 text-[10px] xl:block ${active ? "text-white/70" : "text-muted-foreground/60"}`}>g {key}</kbd>}
              </Link>
            );
          })}
        </nav>
        <div className={`flex p-3 ${collapsed ? "justify-center" : "justify-between"} items-center`}>
          {!collapsed && <span className="pl-2 text-[11px] text-muted-foreground">Marketing</span>}
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch {} return !c; })} aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
        </div>
      </motion.aside>

      <div style={{ "--rail": `${W + 24}px` } as React.CSSProperties} className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300 lg:pl-[var(--rail)]">
        <header className="topbar glass sticky top-3 z-20 mx-3 mt-3 flex h-14 items-center gap-2 rounded-2xl px-3 shadow-[var(--shadow-md)] lg:mx-5">
          <Link href="/" className="lg:hidden" aria-label="Inicio">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon-64.png" alt="FUNDIGSAC" className="size-9 rounded-xl" /></Link>
          <button onClick={() => setPalette(true)} className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-card sm:max-w-sm">
            <Search className="size-4 shrink-0 transition-transform group-hover:scale-110" /><span className="truncate">Buscar o ir a…</span><kbd className="ml-auto hidden rounded-md border border-border px-1.5 text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {ready && showTools && !remoteEnabled && <span title="Los datos viven solo en este navegador. Conecta Supabase para compartirlos." className="hidden items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand md:flex"><FlaskConical className="size-3.5" />Modo local</span>}
            {ready && showTools && (
              <Select aria-label="Ver como" value={s.currentUserId} onChange={(e) => update((x) => { x.currentUserId = e.target.value; })} className="h-9 w-auto max-w-40 py-0 text-xs">
                {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
              </Select>
            )}
            <Button variant="soft" size="sm" onClick={() => setAiOpen(true)} aria-label="Abrir copiloto de IA" className="gap-1.5"><Sparkles className="text-brand" /><span className="hidden sm:inline">Copiloto</span></Button>
            <Button variant="ghost" size="icon" onClick={() => setSheet({ open: true, tab: "avisos" })} aria-label="Avisos" className="relative">
              <Bell />
              <AnimatePresence>{urgent > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-[image:var(--grad-brand)] px-1 text-[10px] font-semibold leading-4 text-white" style={{ animation: "pulse-ring 2s infinite" }}>{urgent}</motion.span>}</AnimatePresence>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
              <AnimatePresence mode="wait" initial={false}><motion.span key={mounted && resolvedTheme === "dark" ? "s" : "m"} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }} className="grid">{mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}</motion.span></AnimatePresence>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 pb-32 lg:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Dock flotante (móvil / tablet) */}
      <nav className="liquid fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-around rounded-full p-1.5 lg:hidden" aria-label="Navegación móvil">
        {NAV.map(({ short, href, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={short} className={`relative flex h-11 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${active ? "text-white" : "text-muted-foreground"}`}>
              {active && <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-full bg-[image:var(--grad-primary)] shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--primary)_85%,transparent)]" transition={spring} />}
              <Icon className="relative size-[19px]" />
              <AnimatePresence initial={false}>{active && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="relative overflow-hidden whitespace-nowrap">{short}</motion.span>}</AnimatePresence>
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
