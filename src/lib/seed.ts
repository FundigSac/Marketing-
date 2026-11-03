import { addDays, todayLima, uid } from "./utils";
import type { EventItem, State } from "./types";

// Feriados nacionales fijos de Perú y fechas internacionales conocidas.
// Quedan como "sugeridas": el equipo debe verificarlas (El Peruano) y puede editarlas o borrarlas.
const FIXED: { md: string; title: string; cat: EventItem["category"]; rel: EventItem["relevance"]; note: string }[] = [
  { md: "01-01", title: "Año Nuevo", cat: "peru", rel: "media", note: "Saludo institucional y planificación del año." },
  { md: "03-22", title: "Día Mundial del Agua", cat: "industria", rel: "alta", note: "Conexión directa con sistemas de tuberías y conducción de agua." },
  { md: "04-22", title: "Día de la Tierra", cat: "industria", rel: "baja", note: "Solo si hay un mensaje creíble sobre infraestructura sostenible." },
  { md: "05-01", title: "Día del Trabajo", cat: "peru", rel: "media", note: "Reconocimiento al equipo y a los instaladores." },
  { md: "06-05", title: "Día Mundial del Medio Ambiente", cat: "industria", rel: "baja", note: "Relación indirecta; priorizar contenido técnico." },
  { md: "06-29", title: "San Pedro y San Pablo", cat: "peru", rel: "baja", note: "Feriado; sin conexión comercial clara." },
  { md: "07-28", title: "Fiestas Patrias", cat: "peru", rel: "media", note: "Saludo institucional." },
  { md: "07-29", title: "Fiestas Patrias", cat: "peru", rel: "baja", note: "Segundo día festivo." },
  { md: "08-06", title: "Batalla de Junín", cat: "peru", rel: "baja", note: "Feriado; verificar vigencia en El Peruano." },
  { md: "08-30", title: "Santa Rosa de Lima", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "10-08", title: "Combate de Angamos", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "11-01", title: "Todos los Santos", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "12-08", title: "Inmaculada Concepción", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "12-09", title: "Batalla de Ayacucho", cat: "peru", rel: "baja", note: "Feriado; verificar vigencia en El Peruano." },
  { md: "12-25", title: "Navidad", cat: "peru", rel: "media", note: "Saludo institucional y cierre de año." },
];

export function seedState(): State {
  const y = Number(todayLima().slice(0, 4));
  const events: EventItem[] = FIXED.map((f) => ({
    id: uid(), title: f.title, category: f.cat, start: `${y}-${f.md}`, allDay: true, repeat: "yearly",
    description: "Fecha sugerida. Verifícala antes de planificar.", reminders: f.rel === "alta" ? [30, 14, 7, 1] : [7, 1],
    relevance: f.rel, relevanceNote: f.note, source: "sugerida", taskIds: [], ideaIds: [],
  }));
  const admin = uid(), fab = uid(), karla = uid();
  const today = todayLima();
  const hdpe = ["Codo HDPE", "Tee HDPE", "Reducción HDPE", "Brida HDPE", "Tapón HDPE", "Tubería HDPE"];
  return {
    version: 2,
    users: [
      { id: admin, name: "Administrador", email: "", role: "admin", active: true },
      { id: fab, name: "Fabrizio", email: "", role: "marketing", active: true },
      { id: karla, name: "Karla", email: "", role: "ventas", phone: "", phonePrimary: true, active: true },
    ],
    events, ideas: [], tasks: [], deliverables: [], files: [], videos: [],
    products: [
      ...hdpe.map((name) => ({ id: uid(), name, category: "Conexiones HDPE", hdpe: true, priority: true, availability: "sin_confirmar" as const, specs: "", pitch: "", photoFileIds: [] })),
      { id: uid(), name: "Válvulas", category: "Válvulas", hdpe: false, priority: false, availability: "sin_confirmar", specs: "", pitch: "", photoFileIds: [] },
    ],
    campaigns: [{
      id: uid(), name: "Prueba HDPE · 15 días", objective: "Generar consultas comerciales y cotizaciones de productos HDPE.",
      status: "propuesta", budget: 300, start: today, end: addDays(today, 14), notes: "Escenario inicial: presupuesto S/250–S/300.", posts: [],
    }],
    metrics: [], leads: [], notifs: [], log: [], deliveryLog: [],
    prefs: {
      email: true, push: false, digest: false, digestHour: 7, recipients: [], quiet: { start: "21:00", end: "07:00" }, ideasPerDay: 3, pushSubs: [],
      categories: {
        peru: { enabled: true, days: [7, 1] }, industria: { enabled: true, days: [14, 3] },
        comercial: { enabled: true, days: [30, 14, 7, 1, 0] }, marketing: { enabled: true, days: [3, 1] },
        entrega: { enabled: true, days: [3, 1, 0] }, grabacion: { enabled: true, days: [1, 0] },
        revision: { enabled: true, days: [1, 0] }, publicacion: { enabled: true, days: [1, 0] },
      },
    },
    schedule: [
      { id: uid(), weekday: 2, label: "Primer borrador", kind: "borrador" },
      { id: uid(), weekday: 3, label: "Revisión", kind: "revision" },
      { id: uid(), weekday: 4, label: "Correcciones", kind: "correcciones" },
      { id: uid(), weekday: 5, label: "Entrega final", kind: "final" },
    ],
    company: { name: "FUNDIGSAC", city: "Perú", salesPhones: [{ label: "Karla (termina en 664)", number: "", primary: true }] },
    ai: { calls: {} },
    currentUserId: admin,
  };
}
