"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell, FlaskConical, Moon, Search, Sparkles, Sun } from "lucide-react";
import { NAV } from "@/lib/nav";
import { update, useMe } from "@/lib/store";
import { deriveAlerts } from "@/lib/alerts";
import { generateIdeas } from "@/lib/actions";
import { todayLima } from "@/lib/utils";
import { localNotify } from "@/lib/notify";
import { ROLE_LABEL } from "@/lib/types";
import { Select } from "@/components/ui/primitives";
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

  useEffect(() => {
    setMounted(true);
    try {
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
  const wide = path.startsWith("/videos") || path.startsWith("/calendario");

  return (
    <div className="min-h-dvh">
      {/* Isla flotante (ref. 21st.dev "Morphing Island Navbar"): marca, secciones y acciones en una sola píldora. */}
      <header className="topbar sticky top-0 z-30 px-3 pt-3 sm:pt-4">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 rounded-full border border-border bg-card/80 p-1.5 pl-2 shadow-[var(--shadow-md)] backdrop-blur-xl">
          <Link href="/" aria-label="FUNDIGSAC · Inicio" className="flex shrink-0 items-center gap-2 rounded-full pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-64.png" alt="" className="size-9 rounded-full" />
            <span className="hidden text-sm font-semibold tracking-tight md:block">FUNDIGSAC</span>
          </Link>
          <nav className="mx-auto hidden items-center gap-0.5 md:flex" aria-label="Principal">
            {NAV.map(({ label, href, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {active && <motion.span layoutId="nav-island" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <Icon className="relative size-4" /><span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            {ready && showTools && !remoteEnabled && <span title="Los datos viven solo en este navegador. Conecta Supabase para compartirlos." className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground xl:flex"><FlaskConical className="size-3.5" />Local</span>}
            {ready && showTools && (
              <Select aria-label="Ver como" value={s.currentUserId} onChange={(e) => update((x) => { x.currentUserId = e.target.value; })} className="h-9 w-auto max-w-32 rounded-full py-0 text-xs">
                {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
              </Select>
            )}
            <IconBtn label="Buscar (Ctrl K)" onClick={() => setPalette(true)}><Search /></IconBtn>
            <IconBtn label="Copiloto de IA" onClick={() => setAiOpen(true)}><Sparkles className="text-brand" /></IconBtn>
            <IconBtn label="Avisos" onClick={() => setSheet({ open: true, tab: "avisos" })}>
              <Bell />
              {urgent > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-card" aria-label={`${urgent} avisos`} />}
            </IconBtn>
            <IconBtn label="Cambiar tema" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}</IconBtn>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 pb-32 pt-10 sm:px-6 md:pb-16 md:pt-14 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        <motion.div key={path} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
      </main>

      {/* Isla inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden" aria-label="Navegación móvil">
        <div className="flex w-full max-w-sm items-center justify-between rounded-full border border-border bg-card/85 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          {NAV.map(({ short, href, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={short} className={`relative flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {active && <motion.span layoutId="tab-island" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-[18px]" />{active && <span className="relative">{short}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <CommandPalette open={palette} setOpen={setPalette} onAssistant={() => { setPalette(false); setAiOpen(true); }} />
      <AiAssistant open={aiOpen} onOpenChange={setAiOpen} />
      <NotificationsSheet open={sheet.open} onOpenChange={(o) => setSheet((p) => ({ ...p, open: o }))} tab={sheet.tab} />
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="relative grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-[18px]">{children}</button>;
}
