export type Role = "creator" | "reviewer";
export type User = { id: string; name: string; email: string; role: Role; active: boolean };

export type EventCategory = "peru" | "industria" | "comercial" | "personal" | "publicacion" | "entrega";
export const EVENT_CATEGORIES: Record<EventCategory, { label: string; color: string }> = {
  peru: { label: "Fecha de Perú", color: "#dc2626" },
  industria: { label: "Sector industrial", color: "#194391" },
  comercial: { label: "Oportunidad comercial", color: "#7c3aed" },
  personal: { label: "Mi evento", color: "#0891b2" },
  publicacion: { label: "Publicación", color: "#f26b1d" },
  entrega: { label: "Entrega", color: "#15803d" },
};

export type EventItem = {
  id: string; title: string; description?: string; category: EventCategory;
  start: string; end?: string; allDay: boolean;
  /** Regla de repetición: no se duplican filas por año. */
  repeat?: "none" | "yearly" | "monthly" | "weekly" | "custom";
  repeatInterval?: number; repeatUntil?: string;
  reminders: number[];
  relevance: "alta" | "media" | "baja" | "descartada";
  relevanceNote?: string;
  source: "sugerida" | "manual";
  taskId?: string;
};

export type ChatMsg = { id: string; role: "user" | "ia"; text: string; at: string };
export type IdeaStatus = "nueva" | "elegida" | "en_produccion" | "descartada";
export type Idea = {
  id: string; title: string; concept: string; script: string; productId?: string; productName?: string;
  duration: string; platform: string; why: string; eventId?: string; date?: string;
  favorite: boolean; status: IdeaStatus; source: "ia" | "plantilla"; createdAt: string; batch?: string;
  versions: { v: number; at: string; note: string; script: string; concept: string }[];
  messages: ChatMsg[];
};

export type Column = "todo" | "edicion" | "revision" | "aprobado" | "publicado";
export const COLUMNS: { id: Column; label: string; weight: number }[] = [
  { id: "todo", label: "Por hacer", weight: 0 }, { id: "edicion", label: "En edición", weight: 40 },
  { id: "revision", label: "En revisión", weight: 65 }, { id: "aprobado", label: "Aprobado", weight: 90 },
  { id: "publicado", label: "Publicado", weight: 100 },
];

export type VideoNote = { id: string; fileId: string; at: number; text: string; mandatory: boolean; resolved: boolean; byId: string; createdAt: string };
export type Task = {
  id: string; title: string; description?: string; status: Column; priority: "alta" | "media" | "baja";
  due?: string; ideaId?: string; eventId?: string; platform?: string; productId?: string; duration?: string;
  checklist: { id: string; text: string; done: boolean }[];
  comments: { id: string; byId: string; at: string; text: string }[];
  files: { id: string; name: string; version: number; at: string; byId: string }[];
  notes: VideoNote[];
  history: { at: string; byId: string; from?: Column; to: Column }[];
  /** El revisor pidió correcciones: la tarjeta vuelve a edición con este aviso hasta que se reenvía. */
  changes?: boolean;
  deliveredAt?: string; approvedAt?: string; publishedAt?: string;
  result?: { url?: string; views?: number; messages?: number; quotes?: number };
  createdAt: string;
};

export type Product = { id: string; name: string; specs: string; notes: string };
export type Notif = { id: string; at: string; title: string; body: string; href: string; read: boolean };
export type LogEntry = { id: string; at: string; byId: string; text: string };
export type DeliveryLog = { key: string; at: string; channel: "email" | "push"; to: string; status: "enviado" | "error" | "omitido"; error?: string; attempts: number };

export type Prefs = {
  email: boolean; push: boolean; recipients: string[]; reminderDays: number[];
  quiet: { start: string; end: string }; ideasPerDay: number; autoDaily: boolean; pushSubs: unknown[];
};

export type State = {
  version: 3;
  users: User[]; events: EventItem[]; ideas: Idea[]; tasks: Task[]; products: Product[];
  notifs: Notif[]; log: LogEntry[]; deliveryLog: DeliveryLog[]; prefs: Prefs;
  ai: { calls: Record<string, number>; lastIdeasDay?: string };
  currentUserId: string;
  /** Datos del sistema anterior (campañas, métricas, consultas, entregables…): se conservan sin mostrarse. */
  legacy?: Record<string, unknown>;
};

export const PLATFORMS = ["TikTok", "Instagram Reels", "Facebook", "YouTube Shorts", "LinkedIn", "YouTube"];
export const REMINDER_OPTIONS = [15, 7, 3, 1];
export const ROLE_LABEL: Record<Role, string> = { creator: "Creador de contenido", reviewer: "Revisor" };
