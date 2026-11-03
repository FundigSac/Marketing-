"use client";

import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui/blocks";

export default function CalendarioMensual() {
  return (
    <>
      <PageHeader title="Calendario mensual" hint="Navega a cualquier año: los eventos anuales, mensuales y semanales se calculan, no se duplican." />
      <CalendarView initialView="dayGridMonth" />
    </>
  );
}
