import { CalendarDays, Clapperboard, Home, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; short: string; href: string; icon: LucideIcon; key: string };

// Solo 4 secciones.
export const NAV: NavItem[] = [
  { label: "Inicio", short: "Inicio", href: "/", icon: Home, key: "i" },
  { label: "Calendario", short: "Calendario", href: "/calendario", icon: CalendarDays, key: "c" },
  { label: "Ideas con IA", short: "Ideas", href: "/ideas", icon: Sparkles, key: "d" },
  { label: "Mis videos", short: "Videos", href: "/videos", icon: Clapperboard, key: "v" },
];
