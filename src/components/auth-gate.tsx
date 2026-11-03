"use client";

import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { PageSkeleton } from "@/components/ui/blocks";
import { remoteEnabled, startRemoteSync, supabase } from "@/lib/sync";
import { useStore } from "@/lib/store";

type Phase = "loading" | "login" | "ready";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(remoteEnabled ? "loading" : "ready");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { ready } = useStore();

  useEffect(() => {
    if (!remoteEnabled) return;
    startRemoteSync().then((r) => setPhase(r.ok ? "ready" : "login"));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => { if (!remoteEnabled && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase()!.auth.signInWithPassword({ email, password });
    if (error) { setError("Correo o contraseña incorrectos."); setBusy(false); return; }
    const r = await startRemoteSync();
    setBusy(false);
    if (r.ok) setPhase("ready"); else setError(r.error ?? "No se pudo cargar el espacio de trabajo.");
  };

  if (phase === "loading" || !ready) return <div className="mx-auto max-w-5xl p-8"><PageSkeleton /></div>;
  if (phase === "login") {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <Card className="liquid w-full max-w-sm space-y-5 p-8">
          <div className="space-y-1 text-center">
            <span className="mx-auto block w-fit rounded-xl bg-[#131415] px-5 py-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logo.png" alt="FUNDIGSAC" className="h-10 w-auto" /></span>
            <h1 className="pt-2 text-xl font-semibold">Marketing</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu cuenta del equipo.</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <Field label="Correo"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Contraseña" error={error}><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button type="submit" className="w-full" disabled={busy}><LogIn />{busy ? "Ingresando…" : "Ingresar"}</Button>
          </form>
        </Card>
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
