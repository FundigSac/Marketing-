import {
  LayoutDashboard, CalendarDays, CalendarRange, ListTodo, CalendarPlus, Radar, Lightbulb, MessagesSquare, ClipboardList,
  KanbanSquare, UserRound, PackageCheck, FolderOpen, Film, Megaphone, Calculator, Boxes, Inbox, BarChart3, GitCompare,
  FileBarChart, Bell, BellRing, Settings2, Sparkles, Clapperboard, TrendingUp, Users, type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; hint?: string };
export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

// 28 pantallas en 6 módulos. Las pantallas 05, 12, 17 y 19 son de detalle y se abren desde su lista.
export const NAV: NavGroup[] = [
  { id: "A", label: "Inicio y planificación", icon: LayoutDashboard, items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Calendario mensual", href: "/calendario", icon: CalendarDays },
    { label: "Calendario semanal", href: "/calendario/semana", icon: CalendarRange },
    { label: "Agenda diaria", href: "/agenda", icon: ListTodo },
    { label: "Nuevo evento", href: "/eventos/nuevo", icon: CalendarPlus },
  ] },
  { id: "B", label: "Inteligencia artificial", icon: Sparkles, items: [
    { label: "Radar de fechas", href: "/ia/radar", icon: Radar },
    { label: "Centro de ideas", href: "/ia/ideas", icon: Lightbulb },
    { label: "Debate de ideas", href: "/ia/debate", icon: MessagesSquare },
    { label: "Plan editorial", href: "/ia/plan", icon: ClipboardList },
  ] },
  { id: "C", label: "Producción", icon: Clapperboard, items: [
    { label: "Kanban editorial", href: "/produccion/kanban", icon: KanbanSquare },
    { label: "Panel de Fabrizio", href: "/produccion/fabrizio", icon: UserRound },
    { label: "Entregables", href: "/produccion/entregables", icon: PackageCheck },
    { label: "Biblioteca", href: "/produccion/biblioteca", icon: FolderOpen },
    { label: "Videos por revisar", href: "/produccion/videos", icon: Film },
  ] },
  { id: "D", label: "Campañas y ventas", icon: Megaphone, items: [
    { label: "Campañas", href: "/campanas", icon: Megaphone },
    { label: "Simulador de presupuesto", href: "/campanas/simulador", icon: Calculator },
    { label: "Productos HDPE", href: "/campanas/productos", icon: Boxes },
    { label: "Consultas y cotizaciones", href: "/campanas/consultas", icon: Inbox },
  ] },
  { id: "E", label: "Métricas", icon: TrendingUp, items: [
    { label: "Resultados", href: "/metricas", icon: BarChart3 },
    { label: "Comparador", href: "/metricas/comparador", icon: GitCompare },
    { label: "Informes", href: "/metricas/informes", icon: FileBarChart },
  ] },
  { id: "F", label: "Comunicación y equipo", icon: Users, items: [
    { label: "Notificaciones", href: "/notificaciones", icon: Bell },
    { label: "Config. de avisos", href: "/notificaciones/configuracion", icon: BellRing },
    { label: "Equipo e integraciones", href: "/admin", icon: Settings2 },
  ] },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
export const MOBILE_TABS: NavItem[] = [
  NAV[0].items[0], NAV[0].items[1], NAV[2].items[0], NAV[1].items[1], NAV[3].items[0],
];
