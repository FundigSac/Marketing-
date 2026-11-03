"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, Plus, Send, Smartphone, X } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, Field, Input, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { deriveAlerts } from "@/lib/alerts";
import { getState, update, useStore } from "@/lib/store";
import { REMINDER_OPTIONS } from "@/lib/types";
import { download, fmtDateTime, todayLima } from "@/lib/utils";

type Status = { email: { configured: boolean }; push: { configured: boolean; publicKey: string | null }; cron: { configured: boolean }; supabase: { configured: boolean; serviceRole: boolean } };
const b64 = (b: string) => { const p = "=".repeat((4 - (b.length % 4)) % 4); const r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const tone = { alta: "bg-destructive", media: "bg-brand", info: "bg-primary" } as const;

export function NotificationsSheet({ open, onOpenChange, tab = "avisos" }: { open: boolean; onOpenChange: (o: boolean) => void; tab?: string }) {
  const { s, ready } = useStore();
  const [t, setT] = useState(tab);
  const [st, setSt] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState("default");
  useEffect(() => { if (open) setT(tab); }, [open, tab]);
  useEffect(() => { if (!open) return; fetch("/api/status").then((r) => r.json()).then(setSt).catch(() => {}); if ("Notification" in window) setPerm(Notification.permission); }, [open]);
  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  if (!ready) return null;
  const p = s.prefs;
  const set = (fn: (x: typeof p) => void) => update((x) => { fn(x.prefs); });
  const registered = [...new Set([...p.recipients, ...s.users.filter((u) => u.active && u.email).map((u) => u.email)])];
  const log = [...s.deliveryLog].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);

  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast.error("Escribe un correo válido."); return; }
    if (!p.recipients.includes(e)) set((x) => { x.recipients.push(e); });
    setEmail("");
  };
  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast.error("Este navegador no soporta push."); return; }
    const r = await Notification.requestPermission(); setPerm(r);
    if (r !== "granted") { toast.error("Permiso denegado."); return; }
    if (!st?.push.configured || !st.push.publicKey) { toast.warning("Permiso concedido, pero el servidor no tiene claves VAPID: aún no llegan push con el navegador cerrado."); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(st.push.publicKey) });
      set((x) => { x.push = true; x.pushSubs = [...x.pushSubs.filter((q) => (q as { endpoint?: string }).endpoint !== sub.endpoint), sub.toJSON()]; });
      toast.success("Este dispositivo recibirá avisos push");
    } catch { toast.error("No se pudo suscribir este dispositivo."); }
  };
  const testEmail = async () => {
    const r = await (await fetch("/api/notify/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "email", to: registered }) })).json();
    r.ok ? toast.success(`Correo de prueba enviado a ${r.sentTo}`) : toast.error(r.error);
  };
  const ok = (v?: boolean) => <Badge tone={v ? "success" : "warning"}>{v ? "Conectado" : "Falta configurar"}</Badge>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side title="Avisos y ajustes" description="Lo que se acerca y cómo quieres que te recordemos." className="max-w-md overflow-hidden">
        <Tabs value={t} onValueChange={setT} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start"><TabsTrigger value="avisos">Avisos ({alerts.length})</TabsTrigger><TabsTrigger value="ajustes">Recordatorios</TabsTrigger></TabsList>
          <TabsContent value="avisos" className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {alerts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Todo en orden. No hay avisos.</p> : (
              <ul className="space-y-1.5">{alerts.map((a) => <li key={a.id}><Link href={a.href} onClick={() => onOpenChange(false)} className="flex gap-3 rounded-lg p-3 text-sm transition hover:bg-accent"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone[a.level]}`} /><span><b className="block">{a.title}</b><span className="text-muted-foreground">{a.body}</span></span></Link></li>)}</ul>
            )}
          </TabsContent>
          <TabsContent value="ajustes" className="mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 text-sm">
            <div><p className="mb-2 font-medium">Avisarme antes de cada fecha o entrega</p><div className="flex flex-wrap gap-2">{REMINDER_OPTIONS.map((d) => <button key={d} aria-pressed={p.reminderDays.includes(d)} onClick={() => set((x) => { x.reminderDays = x.reminderDays.includes(d) ? x.reminderDays.filter((y) => y !== d) : [...x.reminderDays, d].sort((a, b) => b - a); })} className={`rounded-full border px-3 py-1.5 transition ${p.reminderDays.includes(d) ? "border-primary bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{d} {d === 1 ? "día" : "días"} antes</button>)}</div></div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Mail className="size-4" />Correo</span><Switch checked={p.email} onCheckedChange={(on) => set((x) => { x.email = on; })} /></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Servicio de correo (Resend)</span>{ok(st?.email.configured)}</div>
              <div className="flex flex-wrap gap-1.5">{registered.length === 0 && <span className="text-xs text-muted-foreground">Sin destinatarios. Agrega el correo real de Fabrizio.</span>}{registered.map((e) => <span key={e} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{e}{p.recipients.includes(e) && <button aria-label={`Quitar ${e}`} onClick={() => set((x) => { x.recipients = x.recipients.filter((y) => y !== e); })}><X className="size-3" /></button>}</span>)}</div>
              <div className="flex gap-2"><Input type="email" placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} /><Button variant="outline" size="icon" aria-label="Agregar correo" onClick={addEmail}><Plus /></Button></div>
              <Button size="sm" variant="soft" onClick={testEmail} disabled={!registered.length}><Send />Enviar correo de prueba</Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Smartphone className="size-4" />Notificaciones push</span><Switch checked={p.push} onCheckedChange={(on) => set((x) => { x.push = on; })} /></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Claves VAPID en el servidor</span>{ok(st?.push.configured)}</div>
              <Button size="sm" variant="outline" onClick={enablePush}><Bell />Activar en este dispositivo</Button>
              <p className="text-xs text-muted-foreground">Permiso del navegador: {perm === "granted" ? "concedido" : perm === "denied" ? "bloqueado" : "sin responder"} · dispositivos: {p.pushSubs.length}</p>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><span>Ideas del día automáticas</span><Switch checked={p.autoDaily} onCheckedChange={(on) => set((x) => { x.autoDaily = on; })} /></div>
              <Field label="Ideas por día"><Select value={p.ideasPerDay} onChange={(e) => set((x) => { x.ideasPerDay = Number(e.target.value); })}>{[5, 6].map((n) => <option key={n} value={n}>{n} ideas</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Silencio desde"><Input type="time" value={p.quiet.start} onChange={(e) => set((x) => { x.quiet.start = e.target.value; })} /></Field><Field label="hasta"><Input type="time" value={p.quiet.end} onChange={(e) => set((x) => { x.quiet.end = e.target.value; })} /></Field></div>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3 text-xs"><div className="flex items-center justify-between"><span>Servicio programado (diario, 07:00 Lima)</span>{ok(st?.cron.configured && st?.supabase.serviceRole)}</div><div className="flex items-center justify-between"><span>Base de datos compartida (Supabase)</span>{ok(st?.supabase.configured)}</div></div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"><span className="text-muted-foreground">Respaldo de todos tus datos (incluye lo del sistema anterior).</span><Button size="sm" variant="outline" onClick={() => download(`fundigsac-respaldo-${todayLima()}.json`, JSON.stringify(getState(), null, 2), "application/json")}>Descargar</Button></div>
            {log.length > 0 && <div><p className="mb-1 font-medium">Últimos envíos</p><ul className="space-y-1 text-xs">{log.map((l) => <li key={l.key + l.channel} className="flex justify-between gap-2"><span>{l.channel} · {l.to}</span><span className={l.status === "enviado" ? "text-success" : "text-destructive"}>{l.status} · {fmtDateTime(l.at)}</span></li>)}</ul></div>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
