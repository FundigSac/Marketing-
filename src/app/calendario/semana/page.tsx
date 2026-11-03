"use client";

import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui/blocks";

export default function CalendarioSemanal() {
  return (
    <>
      <PageHeader title="Calendario semanal" hint="Actividades, grabaciones, revisiones, publicaciones y entregas de la semana." />
      <CalendarView initialView="timeGridWeek" />
    </>
  );
}
