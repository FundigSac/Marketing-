"use client";

import { del, get, set } from "idb-keyval";

// Archivos en IndexedDB del navegador (modo local). Con Supabase Storage configurado se sustituye este módulo.
export async function putFile(id: string, blob: Blob) { await set("file:" + id, blob); }
export async function getFileBlob(id: string): Promise<Blob | undefined> { return get("file:" + id); }
export async function getFileUrl(id: string): Promise<string | null> {
  const b = await getFileBlob(id);
  return b ? URL.createObjectURL(b) : null;
}
export async function removeFile(id: string) { await del("file:" + id); }

export function guessKind(mime: string, name: string): "imagen" | "video" | "guion" | "logo" | "ficha" | "otro" {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return /logo/i.test(name) ? "logo" : "imagen";
  if (/\.(docx?|txt|md)$/i.test(name)) return "guion";
  if (/\.pdf$/i.test(name)) return "ficha";
  return "otro";
}
