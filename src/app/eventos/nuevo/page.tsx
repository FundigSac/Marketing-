"use client";

import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/ui/blocks";

export default function NuevoEvento() {
  return (<><PageHeader title="Crear evento" hint="Eventos únicos, de varios días, repetitivos o con fecha límite, con recordatorios." /><EventForm /></>);
}
