"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Minus, Plus, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Field, Input, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { PageHeader, PageSkeleton } from "@/components/ui/blocks";
import { replaceState, update, useMe } from "@/lib/store";
import { seedState } from "@/lib/seed";
import { remoteEnabled } from "@/lib/sync";
import { can, ROLE_LABEL, type Action, type Role, type State } from "@/lib/types";
import { download, todayLima, uid } from "@/lib/utils";

const ACTIONS: [Action, string][] = [["events.write", "Crear/editar eventos"], ["ideas.write", "Gestionar ideas"], ["tasks.write", "Gestionar tareas y entregables"], ["tasks.review", "Revisar y aprobar videos"], ["campaigns.write", "Gestionar campañas"], ["metrics.write", "Registrar métricas"], ["leads.write", "Gestionar consultas"], ["products.write", "Editar productos"], ["files.write", "Subir archivos"], ["notifications.config", "Configurar avisos"], ["admin", "Administrar equipo"]];
type Status = { ia: { configured: boolean; model: string }; supabase: { configured: boolean; serviceRole: boolean }; email: { configured: boolean }; push: { configured: boolean }; cron: { configured: boolean } };

export default function Admin() {
  const { s, me, ready } = useMe();
  const [st, setSt] = useState<Status | null>(null);
  const [reset, setReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setSt).catch(() => {}); }, []);
  if (!ready || !me) return <PageSkeleton />;
  const isAdmin = can(me.role, "admin");
  const ok = (v?: boolean) => <Badge tone={v ? "success" : "warning"}>{v ? "Conectado" : "Requiere conexión"}</Badge>;

  const importBackup = async (f: File) => {
    try { const d = JSON.parse(await f.text()) as State; if (d.version !== 2 || !Array.isArray(d.events)) throw 0; if (confirm("Esto reemplaza TODOS los datos actuales. ¿Continuar?")) { replaceState(d); toast.success("Respaldo restaurado"); } } catch { toast.error("El archivo no es un respaldo válido."); }
  };

  return (
    <>
      <PageHeader title="Equipo e integraciones" hint="Usuarios, roles y permisos, perfil de empresa, conexiones externas y respaldo." />
      {!isAdmin && <Card className="mb-4 p-4 text-sm text-muted-foreground">Solo el administrador puede modificar esta sección.</Card>}
      <Tabs defaultValue="equipo">
        <TabsList className="mb-4"><TabsTrigger value="equipo">Equipo</TabsTrigger><TabsTrigger value="permisos">Roles y permisos</TabsTrigger><TabsTrigger value="empresa">Empresa</TabsTrigger><TabsTrigger value="integraciones">Integraciones</TabsTrigger><TabsTrigger value="datos">Datos</TabsTrigger></TabsList>

        <TabsContent value="equipo"><Card><CardHeader><CardTitle>Usuarios</CardTitle>{isAdmin && <Button size="sm" variant="soft" onClick={() => update((x) => { x.users.push({ id: uid(), name: "Nuevo usuario", email: "", role: "visualizador", active: true }); }, "Agregó un usuario")}><Plus />Agregar</Button>}</CardHeader>
          <CardContent className="space-y-3">{s.users.map((u) => (
            <div key={u.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto]">
              <Field label="Nombre"><Input disabled={!isAdmin} value={u.name} onChange={(e) => update((x) => { x.users.find((y) => y.id === u.id)!.name = e.target.value; })} /></Field>
              <Field label="Correo real"><Input type="email" disabled={!isAdmin} value={u.email} onChange={(e) => update((x) => { x.users.find((y) => y.id === u.id)!.email = e.target.value.trim(); })} placeholder="nombre@empresa.com" /></Field>
              <Field label="Rol"><Select disabled={!isAdmin} value={u.role} onChange={(e) => update((x) => { x.users.find((y) => y.id === u.id)!.role = e.target.value as Role; }, `Cambió el rol de ${u.name}`)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
              <Field label="Teléfono"><Input disabled={!isAdmin} value={u.phone ?? ""} onChange={(e) => update((x) => { x.users.find((y) => y.id === u.id)!.phone = e.target.value; })} /></Field>
              <label className="flex items-end gap-2 pb-2 text-sm"><Switch disabled={!isAdmin || u.id === me.id} checked={u.active} onCheckedChange={(on) => update((x) => { x.users.find((y) => y.id === u.id)!.active = on; })} />Activo</label>
            </div>))}
            <p className="text-xs text-muted-foreground">{remoteEnabled ? "Las cuentas de acceso se crean en Supabase Auth; aquí defines el rol y el correo de avisos de cada persona." : "Modo local: el selector de usuario en la barra superior simula cada rol para probar permisos."}</p></CardContent></Card></TabsContent>

        <TabsContent value="permisos"><Card className="overflow-x-auto"><CardHeader><CardTitle>Matriz de permisos</CardTitle></CardHeader><CardContent>
          <table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Permiso</th>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead><tbody>{ACTIONS.map(([a, l]) => <tr key={a} className="border-t border-border"><td className="py-2">{l}</td>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <td key={r} className="text-center">{can(r, a) ? <Check className="mx-auto size-4 text-success" /> : <Minus className="mx-auto size-4 text-muted-foreground/50" />}</td>)}</tr>)}</tbody></table>
          <p className="mt-3 text-xs text-muted-foreground">La aprobación final de contenido, videos y gasto es siempre humana (administrador).</p></CardContent></Card></TabsContent>

        <TabsContent value="empresa"><Card><CardHeader><CardTitle>Perfil de empresa y contactos comerciales</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre"><Input disabled={!isAdmin} value={s.company.name} onChange={(e) => update((x) => { x.company.name = e.target.value; })} /></Field><Field label="País / ciudad"><Input disabled={!isAdmin} value={s.company.city} onChange={(e) => update((x) => { x.company.city = e.target.value; })} /></Field></div>
          <div className="space-y-2"><b className="text-sm">Teléfonos comerciales</b>
            {s.company.salesPhones.map((p, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"><Field label="Etiqueta"><Input disabled={!isAdmin} value={p.label} onChange={(e) => update((x) => { x.company.salesPhones[i].label = e.target.value; })} /></Field><Field label="Número completo" hint={!p.number ? "Pendiente de confirmar" : undefined}><Input disabled={!isAdmin} value={p.number} onChange={(e) => update((x) => { x.company.salesPhones[i].number = e.target.value; })} placeholder="+51 9XX XXX XXX" /></Field><label className="flex items-center gap-2 pb-2 text-sm"><input type="radio" name="primary" disabled={!isAdmin} checked={p.primary} onChange={() => update((x) => { x.company.salesPhones.forEach((q, j) => (q.primary = j === i)); })} />Principal</label>{isAdmin && <Button variant="ghost" size="icon" aria-label="Quitar" onClick={() => update((x) => { x.company.salesPhones.splice(i, 1); })}><Minus /></Button>}</div>)}
            {isAdmin && <Button size="sm" variant="outline" onClick={() => update((x) => { x.company.salesPhones.push({ label: "Secundario", number: "", primary: false }); })}><Plus />Agregar número</Button>}
            <p className="text-xs text-muted-foreground">El número de Karla (termina en 664) es el principal; solo se mostrará en videos y consultas cuando escribas el número completo confirmado. Los demás son secundarios.</p></div></CardContent></Card></TabsContent>

        <TabsContent value="integraciones"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{([
          ["IA · Claude Haiku 5.5", st?.ia.configured, `Variable: ANTHROPIC_API_KEY · modelo ${st?.ia.model ?? "claude-haiku-5-5"}`],
          ["Base de datos y acceso · Supabase", st?.supabase.configured, "Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Ejecuta supabase/migrations/0001_workspace_state.sql"],
          ["Tarea programada (servidor)", st?.cron.configured && st?.supabase.serviceRole, "Variables: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY. vercel.json ya define el cron diario."],
          ["Correo · Resend", st?.email.configured, "Variables: RESEND_API_KEY, RESEND_FROM (dominio verificado)"],
          ["Notificaciones push", st?.push.configured, "Variables: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY"],
          ["Meta · TikTok · WhatsApp", false, "Requieren cuenta de desarrollador, permisos y credenciales. Mientras tanto, importa CSV/Excel."],
        ] as [string, boolean | undefined, string][]).map(([n, v, h]) => <Card key={n} className="p-5"><div className="flex items-start justify-between gap-2"><b className="text-sm">{n}</b>{ok(v)}</div><p className="mt-2 text-xs text-muted-foreground">{h}</p></Card>)}</div></TabsContent>

        <TabsContent value="datos"><Card><CardHeader><CardTitle>Respaldo y mantenimiento</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{remoteEnabled ? "Los datos se sincronizan con Supabase." : "Modo local: los datos viven solo en este navegador. Descarga respaldos con frecuencia. Los archivos (videos, fotos) quedan en el almacenamiento del navegador y no van en el respaldo."}</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download(`fundigsac-respaldo-${todayLima()}.json`, JSON.stringify(s, null, 2), "application/json")}><Download />Descargar respaldo</Button>{isAdmin && <><Button variant="outline" onClick={() => file.current?.click()}><Upload />Restaurar respaldo</Button><input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} /><Button variant="destructive" onClick={() => setReset(true)}>Borrar todos los datos</Button></>}</div></CardContent></Card></TabsContent>
      </Tabs>
      <ConfirmDialog open={reset} onOpenChange={setReset} danger confirmLabel="Borrar todo" title="¿Borrar todos los datos?" description="Vuelve al estado inicial. Descarga un respaldo antes si lo necesitas." onConfirm={() => { replaceState(seedState()); toast.success("Datos reiniciados"); }} />
    </>
  );
}
