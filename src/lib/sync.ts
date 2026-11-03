"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getState, replaceState, setRemoteSave } from "./store";
import type { State } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true solo si hay variables de Supabase. Sin ellas la app funciona en modo local (demostración). */
export const remoteEnabled = !!(url && anon);

let client: SupabaseClient | null = null;
export function supabase() {
  if (!remoteEnabled) return null;
  client ??= createClient(url!, anon!);
  return client;
}

const ROW = "main";

/** Carga el estado compartido del equipo y activa el guardado automático. */
export async function startRemoteSync(): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: "Supabase no configurado" };
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return { ok: false, error: "Sin sesión" };
  const { data, error } = await sb.from("workspace_state").select("data").eq("id", ROW).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.data) {
    // Antes de reemplazar datos de la versión anterior, deja una copia de seguridad en la base.
    if ((data.data as { version?: number }).version === 2) await sb.from("workspace_state").upsert({ id: "main-v2-backup", data: data.data });
    replaceState(data.data as State);
  }
  else await sb.from("workspace_state").upsert({ id: ROW, data: getState() });
  setRemoteSave(async (s) => { await sb.from("workspace_state").upsert({ id: ROW, data: s, updated_at: new Date().toISOString() }); });
  return { ok: true };
}
