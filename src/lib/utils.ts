import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);
export const NUM = (n: number) => new Intl.NumberFormat("es-PE").format(n || 0);

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Hoy en Lima (YYYY-MM-DD). */
export const todayLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
export const nowLimaISO = () => {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "medium" }).format(new Date());
  return p.replace(" ", "T");
};

/** Fecha peruana: 3 nov 2026 */
export const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
};
export const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b.slice(0, 10) + "T00:00:00").getTime() - new Date(a.slice(0, 10) + "T00:00:00").getTime()) / 86400000);

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const mmss = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export function download(name: string, content: BlobPart, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
