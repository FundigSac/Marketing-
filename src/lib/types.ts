export type Role = "admin" | "marketing" | "ventas" | "visualizador";

export type User = {
  id: string; name: string; email: string; role: Role;
  phone?: string; phonePrimary?: boolean; active: boolean;
};

export type EventCategory = "peru" | "industria" | "comercial" | "marketing" | "entrega" | "grabacion" | "revision" | "publicacion";

export type EventItem = {
  id: string; title: string; description?: string; category: EventCategory;
  start: string; end?: string; allDay: boolean;
  /** Regla de repetición: no se duplican filas; el calendario las expande. */
  repeat?: "none" | "yearly" | "monthly" | "weekly" | "custom";
  repeatInterval?: number; repeatUntil?: string;
  ownerId?: string; campaignId?: string; contentType?: string;
  reminders: number[]; // días de anticipación (30,14,7,3,1,0)
  relevance: "alta" | "media" | "baja" | "descartada";
  relevanceNote?: string;
  source: "sugerida" | "manual";
  taskIds: string[]; ideaIds: string[];
};

export type IdeaStatus = "propuesta" | "en_debate" | "elegida" | "en_preparacion" | "en_revision" | "aprobada" | "programada" | "publicada" | "descartada";

export type IdeaBody = {
  title: string; date?: string; productId?: string; objective: string; network: string;
  contentType: string; visual: string; script: string; resources: string; why: string;
  priority: "alta" | "media" | "baja";
};
export type ChatMsg = { id: string; role: "user" | "ia"; text: string; at: string };
export type Idea = IdeaBody & {
  id: string; status: IdeaStatus; eventId?: string; source: "ia" | "plantilla" | "manual";
  createdAt: string; versions: { v: number; at: string; body: IdeaBody; note: string }[];
  messages: ChatMsg[]; decisions: { at: string; by: string; text: string }[];
};

export type TaskStatus = "pendiente" | "produccion" | "entregado" | "revision" | "cambios" | "aprobado" | "programado" | "publicado" | "analizado";

export type Task = {
  id: string; title: string; description?: string; status: TaskStatus;
  priority: "alta" | "media" | "baja"; assigneeId?: string; due?: string;
  productId?: string; contentType?: string; ideaId?: string; campaignId?: string; eventId?: string;
  attachments: { id: string; name: string }[];
  comments: { id: string; byId: string; at: string; text: string }[];
  history: { at: string; byId: string; from?: TaskStatus; to: TaskStatus }[];
  checklist: { id: string; text: string; done: boolean }[];
  createdAt: string;
};

export type DeliverableKind = "borrador" | "revision" | "correcciones" | "final" | "otro";
export type Deliverable = {
  id: string; taskId?: string; title: string; kind: DeliverableKind; assigneeId?: string;
  dueAt: string; receivedAt?: string; fileId?: string; notes?: string; corrections?: string;
};

export type FileKind = "imagen" | "video" | "guion" | "logo" | "ficha" | "otro";
export type FileItem = { id: string; name: string; mime: string; size: number; kind: FileKind; productId?: string; addedAt: string; byId?: string };

export type VideoNote = { id: string; at: number; text: string; mandatory: boolean; resolved: boolean; shot?: string; byId: string; version: number; createdAt: string };
export type VideoReview = {
  id: string; title: string; taskId?: string; platform: string;
  versions: { v: number; fileId: string; at: string; byId?: string }[];
  notes: VideoNote[]; checklist: Record<string, boolean>;
  status: "pendiente" | "en_revision" | "cambios" | "aprobado";
  approvedById?: string; approvedAt?: string;
};

export type Product = {
  id: string; name: string; category: string; hdpe: boolean; priority: boolean;
  availability: "disponible" | "agotado" | "bajo_pedido" | "sin_confirmar";
  /** Solo datos cargados por el equipo; la IA no inventa especificaciones. */
  specs: string; pitch: string; photoFileIds: string[];
};

export type Metric = {
  id: string; campaignId: string; date: string; productId?: string; postId?: string; network: string;
  spend: number; reach: number; views: number; interactions: number; clicks: number;
  messages: number; quotes: number; sales: number; salesAmount: number; source: "manual" | "csv" | "excel";
};
export type Post = { id: string; date: string; network: string; title: string; ideaId?: string; productId?: string; url?: string };
export type Campaign = {
  id: string; name: string; objective: string; status: "propuesta" | "activa" | "terminada" | "cancelada";
  ownerId?: string; budget: number; start: string; end: string; notes?: string;
  posts: Post[];
};

export type LeadStage = "mensaje" | "cotizacion" | "negociacion" | "venta" | "perdida";
export type Lead = {
  id: string; contact: string; channel: string; stage: LeadStage; date: string;
  campaignId?: string; productId?: string; postId?: string; amount?: number; notes?: string;
  history: { at: string; stage: LeadStage }[];
};

export type Notif = { id: string; at: string; kind: string; title: string; body: string; read: boolean; link?: string };
export type LogEntry = { id: string; at: string; byId: string; text: string };

export type NotifPrefs = {
  email: boolean; push: boolean; digest: boolean; digestHour: number;
  recipients: string[];
  quiet: { start: string; end: string };
  categories: Record<string, { enabled: boolean; days: number[] }>;
  ideasPerDay: number;
  autoDaily?: boolean;
  pushSubs: unknown[];
};
export type DeliveryEntry = { id: string; weekday: number; label: string; kind: DeliverableKind };

export type DeliveryLog = { key: string; at: string; channel: "email" | "push"; to: string; status: "enviado" | "error" | "omitido"; error?: string; attempts: number };

export type State = {
  version: 2;
  users: User[]; events: EventItem[]; ideas: Idea[]; tasks: Task[]; deliverables: Deliverable[];
  files: FileItem[]; videos: VideoReview[]; products: Product[]; campaigns: Campaign[];
  metrics: Metric[]; leads: Lead[]; notifs: Notif[]; log: LogEntry[]; deliveryLog: DeliveryLog[];
  prefs: NotifPrefs; schedule: DeliveryEntry[];
  company: { name: string; city: string; salesPhones: { label: string; number: string; primary: boolean }[] };
  ai: { calls: Record<string, number>; lastIdeasDay?: string };
  currentUserId: string;
};

export const TASK_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "pendiente", label: "Pendiente" }, { id: "produccion", label: "En producción" },
  { id: "entregado", label: "Entregado" }, { id: "revision", label: "En revisión" },
  { id: "cambios", label: "Requiere cambios" }, { id: "aprobado", label: "Aprobado" },
  { id: "programado", label: "Programado" }, { id: "publicado", label: "Publicado" },
  { id: "analizado", label: "Analizado" },
];
export const IDEA_FLOW: { id: IdeaStatus; label: string }[] = [
  { id: "propuesta", label: "Propuesta" }, { id: "en_debate", label: "En debate" }, { id: "elegida", label: "Elegida" },
  { id: "en_preparacion", label: "En preparación" }, { id: "en_revision", label: "En revisión" },
  { id: "aprobada", label: "Aprobada" }, { id: "programada", label: "Programada" }, { id: "publicada", label: "Publicada" },
];
export const EVENT_CATEGORIES: Record<EventCategory, { label: string; color: string }> = {
  peru: { label: "Fecha Perú", color: "#dc2626" },
  industria: { label: "Sector industrial", color: "#194391" },
  comercial: { label: "Fecha comercial", color: "#7c3aed" },
  marketing: { label: "Calendario editorial", color: "#f26b1d" },
  entrega: { label: "Entrega de Fabrizio", color: "#15803d" },
  grabacion: { label: "Grabación", color: "#0891b2" },
  revision: { label: "Revisión", color: "#ca8a04" },
  publicacion: { label: "Publicación", color: "#db2777" },
};
export const VIDEO_CHECKLIST = [
  "Realismo de los productos", "Exactitud de imágenes y nombres", "Tipografía", "Animaciones", "Transiciones",
  "Audio", "Logo e identidad corporativa", "Contactos comerciales", "Duración", "Calidad del cierre",
  "Adecuación a la plataforma de publicación",
];
export const NETWORKS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "YouTube", "WhatsApp", "Otra"];
export const CONTENT_TYPES = ["Video corto", "Video largo", "Carrusel", "Imagen", "Historia", "Artículo", "Catálogo"];

export type Action =
  | "events.write" | "tasks.write" | "tasks.review" | "ideas.write" | "campaigns.write" | "metrics.write"
  | "leads.write" | "products.write" | "files.write" | "admin" | "notifications.config";
const PERMS: Record<Role, Action[]> = {
  admin: ["events.write", "tasks.write", "tasks.review", "ideas.write", "campaigns.write", "metrics.write", "leads.write", "products.write", "files.write", "admin", "notifications.config"],
  marketing: ["events.write", "tasks.write", "ideas.write", "campaigns.write", "metrics.write", "products.write", "files.write"],
  ventas: ["leads.write", "metrics.write", "files.write"],
  visualizador: [],
};
export const can = (role: Role, a: Action) => PERMS[role].includes(a);
export const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", marketing: "Marketing", ventas: "Ventas", visualizador: "Visualizador" };

export const VIDEO_STATUS: Record<VideoReview["status"], [string, "primary" | "warning" | "success" | "brand"]> = {
  pendiente: ["Pendiente de revisión", "brand"], en_revision: ["En revisión", "primary"], cambios: ["Cambios solicitados", "warning"], aprobado: ["Aprobado", "success"],
};
