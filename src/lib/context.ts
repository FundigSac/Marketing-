import { upcomingEvents } from "./domain";
import { todayLima, uid } from "./utils";
import type { Idea, State } from "./types";

/** Ángulos de contenido que rotan cada día para que las ideas no se parezcan entre días ni entre sí. */
export const ANGLES = [
  "Error común de obra y cómo evitarlo con el producto correcto",
  "Cómo pedir una cotización sin errores: qué datos tener a la mano",
  "Un producto de la línea HDPE explicado en pocos segundos",
  "Detrás de cámaras: almacén, despacho o preparación de un pedido",
  "Mito o creencia del rubro y lo que sí se confirma con el proveedor",
  "Caso de uso: dónde se instala y para qué sirve cada conexión",
  "Pregunta frecuente de clientes respondida en 30 segundos",
  "Fecha o temporada cercana y cómo planificar la compra",
  "Comparación sencilla entre dos opciones, sin inventar datos técnicos",
  "Checklist de verificación antes de recibir o instalar material",
];
/** Devuelve `n` ángulos consecutivos que empiezan en un punto distinto cada día. */
export function anglesOfDay(date: string, n = 5): string[] {
  const day = Math.floor(Date.parse(date + "T00:00:00Z") / 86400000) || 0;
  const start = (day * n) % ANGLES.length;
  return Array.from({ length: n }, (_, k) => ANGLES[(start + k) % ANGLES.length]);
}

/** Contexto compacto y verificable que se envía a la IA: solo datos cargados en la app. */
export function buildContext(s: State) {
  const today = todayLima();
  return {
    hoy: today, zonaHoraria: "America/Lima",
    objetivoComercial: "Generar consultas y cotizaciones; priorizar conexiones y productos HDPE.",
    fuentesTendencias: "no conectadas",
    angulosDelDia: anglesOfDay(today),
    productos: s.products.map((p) => ({ nombre: p.name, especificacionesVerificadas: p.specs || "por confirmar", notas: p.notes || undefined })),
    fechasProximas: upcomingEvents(s.events, today, 75).slice(0, 12).map((u) => ({ titulo: u.e.title, fecha: u.date, enDias: u.in, relevancia: u.e.relevance, nota: u.e.relevanceNote })),
    ideasExistentes: s.ideas.slice(0, 50).map((i) => ({ titulo: i.title, estado: i.status, favorita: i.favorite })),
    publicacionesAnteriores: s.tasks.filter((t) => t.status === "publicado").slice(0, 20).map((t) => ({ titulo: t.title, plataforma: t.platform, publicado: t.publishedAt?.slice(0, 10), resultados: t.result ?? "sin datos registrados" })),
    tareasEnCurso: s.tasks.filter((t) => t.status !== "publicado").slice(0, 30).map((t) => ({ titulo: t.title, estado: t.status, entrega: t.due })),
  };
}

export type AiIdea = { title: string; concept: string; script: string; productName: string; duration: string; platform: string; why: string; date: string };

const matchProduct = (s: State, name: string) => {
  const n = (name || "").toLowerCase();
  if (!n) return undefined;
  return (s.products.find((p) => p.name.toLowerCase() === n) ?? s.products.find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n)))?.id;
};

export function toIdea(s: State, a: AiIdea, source: Idea["source"], eventId?: string, batch?: string): Idea {
  const now = new Date().toISOString();
  const productId = matchProduct(s, a.productName);
  return {
    id: uid(), title: a.title, concept: a.concept, script: a.script, productId, productName: productId ? undefined : a.productName,
    duration: a.duration, platform: a.platform, why: a.why, eventId, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : undefined,
    favorite: false, status: "nueva", source, createdAt: now, batch,
    versions: [{ v: 1, at: now, note: "Versión inicial", script: a.script, concept: a.concept }], messages: [],
  };
}

