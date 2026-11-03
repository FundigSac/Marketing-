"use client";

import { useSyncExternalStore } from "react";
import { seedState } from "./seed";
import { toV3 } from "./migrate";
import { nowLimaISO, uid } from "./utils";
import type { State, User } from "./types";

const KEY = "fundigsac-os-v3";
const OLD_KEY = "fundigsac-os-v2"; // datos de la versión anterior: se migran y NO se borran
let state: State | null = null;
const listeners = new Set<() => void>();
let remoteSave: ((s: State) => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = toV3(JSON.parse(raw));
    else {
      const old = localStorage.getItem(OLD_KEY);
      state = old ? toV3(JSON.parse(old)) : seedState();
      if (old) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
    }
  } catch {
    state = seedState();
  }
  return state;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  if (remoteSave) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => state && remoteSave?.(state), 1200);
  }
}

/** Actualiza el estado y, opcionalmente, deja constancia en el historial de acciones. */
export function update(fn: (s: State) => State | void, logText?: string) {
  const cur = load();
  const draft = structuredClone(cur);
  const next = fn(draft) ?? draft;
  state = logText
    ? { ...next, log: [{ id: uid(), at: nowLimaISO(), byId: next.currentUserId, text: logText }, ...next.log].slice(0, 500) }
    : next;
  persist();
  listeners.forEach((l) => l());
}

export function replaceState(s: State) {
  state = toV3(s);
  persist();
  listeners.forEach((l) => l());
}
export function setRemoteSave(fn: ((s: State) => void) | null) { remoteSave = fn; }
export function getState() { return load(); }

const EMPTY = { version: 3 } as unknown as State;

export function useStore() {
  const s = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    load,
    () => EMPTY,
  );
  return { s, ready: s !== EMPTY };
}

export function useMe(): { me: User | undefined; s: State; ready: boolean } {
  const { s, ready } = useStore();
  return { me: ready ? s.users.find((u) => u.id === s.currentUserId) ?? s.users[0] : undefined, s, ready };
}

export const userName = (s: State, id?: string) => s.users.find((u) => u.id === id)?.name ?? "—";
export const productName = (s: State, id?: string) => s.products.find((p) => p.id === id)?.name ?? "";
