"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, Plus, Send, Smartphone, X } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Switch } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { update, useMe } from "@/lib/store";
import { can, EVENT_CATEGORIES, type EventCategory } from "@/lib/types";

const DAYS = [30, 14, 7, 3, 1, 0];
type Status = { email: { configured: boolean; from: string }; push: { configured: boolean; publicKey: string | null }; cron: { configured: boolean }; supabase: { configured: boolean; serviceRole: boolean } };

const b64 = (b: string) => { const p = "=".repeat((4 - (b.length % 4)) % 4); const r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

export default function ConfigAvisos() {
  const { s, me, ready } = useMe();
  const [st, setSt] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState("default");
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setSt).catch(() => {}); if ("Notification" in window) setPerm(Notification.permission); }, []);
  if (!ready || !me) return <PageSkeleton />;
  const canEdit = can(me.role, "notifications.config");
  const p = s.prefs;
  const set = (fn: (x: typeof p) => void) => update((state) => { fn(state.prefs); });
  const registered = [...new Set([...p.recipients, ...s.users.filter((u) => u.active && u.email).map((u) => u.email)])];

  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast.error("Escribe un correo válido."); return; }
    if (p.recipients.includes(e)) return;
    set((x) => { x.recipients.push(e); }); setEmail("");
  };

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast.error("Este navegador no soporta notificaciones push."); return; }
    const r = await Notification.requestPermission(); setPerm(r);
    if (r !== "granted") { toast.error("Permiso de notificaciones denegado."); return; }
    if (!st?.push.configured || !st.push.publicKey) { toast.warning("Permiso concedido, pero el servidor no tiene claves VAPID: aún no se pueden enviar push con el navegador cerrado."); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(st.push.publicKey) });
      set((x) => { x.push = true; x.pushSubs = [...x.pushSubs.filter((q) => (q as { endpoint?: string }).endpoint !== sub.endpoint), sub.toJSON()]; });
      toast.success("Este dispositivo recibirá avisos push");
    } catch { toast.error("No se pudo suscribir este dispositivo."); }
  };

  const testEmail = async () => {
    const r = await (await fetch("/api/notify/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "email", to: registered }) })).json();
    r.ok ? toast.success(`Correo de prueba enviado a ${r.sentTo} destinatario(s)`) : toast.error(r.error);
  };
  const testPush = async () => {
    const sub = p.pushSubs[p.pushSubs.length - 1];
    const r = await (await fetch("/api/notify/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "push", subscription: sub }) })).json();
    r.ok ? toast.success("Push de prueba enviado") : toast.error(r.error);
  };
  const localTest = () => { if (perm !== "granted") { toast.error("Primero concede el permiso del navegador."); return; } new Notification("FUNDIGSAC", { body: "Aviso local de prueba (solo con la pestaña abierta)." }); };

  const dot = (ok?: boolean) => <Badge tone={ok ? "success" : "warning"}>{ok ? "Configurado" : "Falta configurar"}</Badge>;

  return (
    <>
      <PageHeader title="Configuración de avisos" hint="Correos, push, horarios, frecuencia y destinatarios. Cada categoría tiene sus propios avisos." />
      {!canEdit && <Card className="mb-4 p-4 text-sm text-muted-foreground">Tu rol solo puede ver esta configuración.</Card>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Avisos por categoría</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(EVENT_CATEGORIES) as [EventCategory, { label: string; color: string }][]).map(([k, v]) => { const c = p.categories[k] ?? { enabled: true, days: [1] }; return (
              <div key={k} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><i className="size-2.5 rounded-full" style={{ background: v.color }} />{v.label}</span><Switch disabled={!canEdit} checked={c.enabled} onCheckedChange={(on) => set((x) => { x.categories[k] = { ...c, enabled: on }; })} aria-label={`Activar ${v.label}`} /></div>
                {c.enabled && <div className="mt-2 flex flex-wrap gap-1.5">{DAYS.map((d) => <button key={d} disabled={!canEdit} aria-pressed={c.days.includes(d)} onClick={() => set((x) => { x.categories[k] = { ...c, days: c.days.includes(d) ? c.days.filter((y) => y !== d) : [...c.days, d].sort((a, b) => b - a) }; })} className={`rounded-full border px-2.5 py-1 text-xs transition ${c.days.includes(d) ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{d === 0 ? "Mismo día" : `${d} d`}</button>)}</div>}
              </div>); })}
            <p className="text-xs text-muted-foreground">Un evento solo avisa en los días que estén activos aquí <b>y</b> marcados en su propio recordatorio.</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Canales</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2"><div className="flex items-center justify-between"><span className="flex items-center gap-2"><Mail className="size-4" />Correo</span><Switch disabled={!canEdit} checked={p.email} onCheckedChange={(on) => set((x) => { x.email = on; })} /></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Resend en el servidor</span>{dot(st?.email.configured)}</div></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><span className="flex items-center gap-2"><Smartphone className="size-4" />Push</span><Switch disabled={!canEdit} checked={p.push} onCheckedChange={(on) => set((x) => { x.push = on; })} /></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Claves VAPID</span>{dot(st?.push.configured)}</div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={enablePush}><Bell />Activar en este dispositivo</Button><Button size="sm" variant="ghost" onClick={localTest}>Prueba local</Button>{p.pushSubs.length > 0 && <Button size="sm" variant="ghost" onClick={testPush}>Push real de prueba</Button>}</div><p className="text-xs text-muted-foreground">Permiso del navegador: <b>{perm === "granted" ? "concedido" : perm === "denied" ? "bloqueado" : "sin responder"}</b> · dispositivos suscritos: {p.pushSubs.length}</p></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Tarea programada (CRON_SECRET)</span>{dot(st?.cron.configured && st?.supabase.serviceRole)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Horarios y frecuencia</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Resumen diario</span><Switch disabled={!canEdit} checked={p.digest} onCheckedChange={(on) => set((x) => { x.digest = on; })} /></div>
              {p.digest && <Field label="Enviar desde la hora (Lima)"><Select disabled={!canEdit} value={p.digestHour} onChange={(e) => set((x) => { x.digestHour = Number(e.target.value); })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</Select></Field>}
              <div className="grid grid-cols-2 gap-3"><Field label="Silencio desde"><Input type="time" disabled={!canEdit} value={p.quiet.start} onChange={(e) => set((x) => { x.quiet.start = e.target.value; })} /></Field><Field label="hasta"><Input type="time" disabled={!canEdit} value={p.quiet.end} onChange={(e) => set((x) => { x.quiet.end = e.target.value; })} /></Field></div>
              <div className="flex items-center justify-between"><span>Generar ideas del día al abrir la app</span><Switch disabled={!canEdit} checked={p.autoDaily !== false} onCheckedChange={(on) => set((x) => { x.autoDaily = on; })} aria-label="Ideas automáticas" /></div>
              <Field label="Ideas de IA por día (3 a 5)"><Select disabled={!canEdit} value={p.ideasPerDay} onChange={(e) => set((x) => { x.ideasPerDay = Number(e.target.value); })}>{[3, 4, 5].map((n) => <option key={n} value={n}>{n} ideas</option>)}</Select></Field>
              <p className="text-xs text-muted-foreground">Zona horaria: America/Lima. El servidor revisa una vez al día (07:00).</p>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Destinatarios de correo</CardTitle><Button size="sm" variant="soft" onClick={testEmail} disabled={!registered.length}><Send />Enviar correo de prueba</Button></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">{registered.length === 0 && <span className="text-sm text-muted-foreground">Sin destinatarios. Agrega correos reales del equipo.</span>}{registered.map((e) => <span key={e} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">{e}{p.recipients.includes(e) && canEdit && <button aria-label={`Quitar ${e}`} onClick={() => set((x) => { x.recipients = x.recipients.filter((y) => y !== e); })}><X className="size-3.5" /></button>}</span>)}</div>
            {canEdit && <div className="flex max-w-md gap-2"><Input type="email" placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} /><Button variant="outline" onClick={addEmail}><Plus />Agregar</Button></div>}
            <p className="text-xs text-muted-foreground">Solo se envía a correos que el equipo registró aquí o en Equipo e integraciones.</p>
          </CardContent>
        </Card>
              </div>
    </>
  );
}
