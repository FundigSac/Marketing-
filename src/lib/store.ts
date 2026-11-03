"use client";

import { useSyncExternalStore } from "react";
import { seedState } from "./seed";
import { nowLimaISO, uid } from "./utils";
import type { State, User } from "./types";

const KEY = "fundigsac-os-v2";
let state: State | null = null;
const listeners = new Set<() => void>();
let remoteSave: ((s: State) => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = parsed?.version === 2 ? ({ ...seedState(), ...parsed } as State) : seedState();
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
  state = { ...seedState(), ...s, version: 2 };
  persist();
  listeners.forEach((l) => l());
}
export function setRemoteSave(fn: ((s: State) => void) | null) { remoteSave = fn; }
export function getState() { return load(); }

const EMPTY = { version: 2 } as unknown as State;

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
