"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CheckCheck, Mail, Smartphone } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { deriveAlerts } from "@/lib/alerts";
import { update, useMe } from "@/lib/store";
import { fmtDateTime, todayLima } from "@/lib/utils";

const TONE = { alta: "bg-destructive", media: "bg-brand", info: "bg-primary" } as const;

export default function Notificaciones() {
  const { s, ready } = useMe();
  const [tab, setTab] = useState("avisos");
  const [seen, setSeen] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("alerts-seen") || "[]"); } catch { return []; } });
  const alerts = useMemo(() => (ready ? deriveAlerts(s, todayLima()) : []), [s, ready]);
  if (!ready) return <PageSkeleton />;
  const markAll = () => { const ids = alerts.map((a) => a.id); setSeen(ids); try { localStorage.setItem("alerts-seen", JSON.stringify(ids)); } catch {} };
  const log = [...(s.deliveryLog ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader title="Centro de notificaciones" hint="Avisos importantes, fechas próximas, tareas vencidas y entregables recibidos."
        actions={<><Button variant="outline" onClick={markAll}><CheckCheck />Marcar como vistos</Button><Button variant="soft" asChild><Link href="/notificaciones/configuracion">Configurar avisos</Link></Button></>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="avisos">Avisos ({alerts.length})</TabsTrigger><TabsTrigger value="envios">Envíos por correo / push ({log.length})</TabsTrigger><TabsTrigger value="historial">Historial de acciones</TabsTrigger></TabsList></Tabs>
      {tab === "avisos" && (alerts.length === 0 ? <EmptyState icon={Bell} title="Todo en orden" text="No hay avisos pendientes." /> : (
        <div className="space-y-2">{alerts.map((a) => (
          <Link key={a.id} href={a.href}><Card className={`flex items-start gap-3 p-4 transition hover:bg-accent ${seen.includes(a.id) ? "opacity-60" : ""}`}><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${TONE[a.level]}`} /><div><b className="text-sm">{a.title}</b><p className="text-sm text-muted-foreground">{a.body}</p></div><Badge className="ml-auto" tone={a.level === "alta" ? "danger" : a.level === "media" ? "brand" : "primary"}>{a.level === "info" ? "info" : a.level}</Badge></Card></Link>
        ))}</div>
      ))}
      {tab === "envios" && (
        <Card><CardHeader><CardTitle>Registro de envíos reales</CardTitle></CardHeader><CardContent>
          {log.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay envíos. Se registran cuando el servidor ejecuta la tarea programada (requiere Supabase, Resend y CRON_SECRET) o al enviar una prueba.</p> : (
            <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Cuándo</th><th>Canal</th><th>Destino</th><th>Estado</th><th>Intentos</th></tr></thead><tbody>{log.slice(0, 80).map((l) => <tr key={l.key + l.channel} className="border-t border-border"><td className="py-2">{fmtDateTime(l.at)}</td><td>{l.channel === "email" ? <Mail className="inline size-4" /> : <Smartphone className="inline size-4" />} {l.channel}</td><td className="max-w-48 truncate">{l.to}</td><td><Badge tone={l.status === "enviado" ? "success" : l.status === "error" ? "danger" : "neutral"}>{l.status}</Badge>{l.error && <span className="ml-2 text-xs text-destructive">{l.error}</span>}</td><td>{l.attempts}</td></tr>)}</tbody></table>
          )}
        </CardContent></Card>
      )}
      {tab === "historial" && (
        <Card><CardHeader><CardTitle>Quién hizo qué y cuándo</CardTitle><Button size="sm" variant="ghost" onClick={() => update((st) => { st.log = []; })}>Limpiar</Button></CardHeader><CardContent>
          {s.log.length === 0 ? <p className="text-sm text-muted-foreground">Sin acciones registradas.</p> : <ul className="divide-y divide-border text-sm">{s.log.slice(0, 100).map((l) => <li key={l.id} className="flex justify-between gap-3 py-2"><span><b>{s.users.find((u) => u.id === l.byId)?.name ?? "—"}</b> {l.text}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(l.at)}</span></li>)}</ul>}
        </CardContent></Card>
      )}
    </>
  );
}
