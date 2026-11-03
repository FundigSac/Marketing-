import { todayLima, uid } from "./utils";
import type { EventItem, State } from "./types";

// Fechas fijas de Perú e internacionales conocidas. Quedan como "sugeridas": se pueden editar o borrar.
// No se inventan feriados móviles (Semana Santa, Día de la Madre, etc.): se agregan a mano.
const FIXED: { md: string; title: string; cat: EventItem["category"]; rel: EventItem["relevance"]; note: string }[] = [
  { md: "01-01", title: "Año Nuevo", cat: "peru", rel: "media", note: "Saludo de inicio de año y plan de contenido." },
  { md: "03-22", title: "Día Mundial del Agua", cat: "industria", rel: "alta", note: "Conexión directa con tuberías y conducción de agua: ideal para contenido educativo sobre HDPE." },
  { md: "04-22", title: "Día de la Tierra", cat: "industria", rel: "baja", note: "Solo con un mensaje creíble sobre infraestructura." },
  { md: "05-01", title: "Día del Trabajo", cat: "peru", rel: "media", note: "Reconocimiento a instaladores y equipo." },
  { md: "06-05", title: "Día Mundial del Medio Ambiente", cat: "industria", rel: "baja", note: "Relación indirecta; priorizar contenido técnico." },
  { md: "06-29", title: "San Pedro y San Pablo", cat: "peru", rel: "baja", note: "Feriado sin conexión comercial clara." },
  { md: "07-28", title: "Fiestas Patrias", cat: "peru", rel: "media", note: "Saludo institucional." },
  { md: "07-29", title: "Fiestas Patrias", cat: "peru", rel: "baja", note: "Segundo día festivo." },
  { md: "08-06", title: "Batalla de Junín", cat: "peru", rel: "baja", note: "Feriado; verifica vigencia en El Peruano." },
  { md: "08-30", title: "Santa Rosa de Lima", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "10-08", title: "Combate de Angamos", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "11-01", title: "Todos los Santos", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "12-08", title: "Inmaculada Concepción", cat: "peru", rel: "baja", note: "Feriado." },
  { md: "12-09", title: "Batalla de Ayacucho", cat: "peru", rel: "baja", note: "Feriado; verifica vigencia en El Peruano." },
  { md: "12-25", title: "Navidad", cat: "peru", rel: "media", note: "Saludo y cierre de año." },
];

export function seedState(): State {
  const y = Number(todayLima().slice(0, 4));
  const events: EventItem[] = FIXED.map((f) => ({
    id: uid(), title: f.title, category: f.cat, start: `${y}-${f.md}`, allDay: true, repeat: "yearly",
    description: "Fecha sugerida. Verifícala antes de planificar.", reminders: f.rel === "alta" ? [15, 7, 3, 1] : [7, 1],
    relevance: f.rel, relevanceNote: f.note, source: "sugerida",
  }));
  const fab = uid(), rev = uid();
  return {
    version: 3,
    users: [
      { id: fab, name: "Fabrizio", email: "", role: "creator", active: true },
      { id: rev, name: "Gerencia", email: "", role: "reviewer", active: true },
    ],
    events, ideas: [], tasks: [],
    // Sin especificaciones inventadas: el equipo las completa. La IA dirá "por confirmar".
    products: ["Codo HDPE", "Tee HDPE", "Reducción HDPE", "Brida HDPE", "Tapón HDPE", "Tubería HDPE", "Válvulas"].map((name) => ({ id: uid(), name, specs: "", notes: "" })),
    notifs: [], log: [], deliveryLog: [],
    prefs: { email: true, push: false, recipients: [], reminderDays: [15, 7, 3, 1], quiet: { start: "21:00", end: "07:00" }, ideasPerDay: 4, autoDaily: true, pushSubs: [] },
    ai: { calls: {} },
    currentUserId: fab,
  };
}
