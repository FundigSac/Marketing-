"use client";

import { useParams } from "next/navigation";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/ui/blocks";

export default function EditarEvento() {
  const { id } = useParams<{ id: string }>();
  return (<><PageHeader title="Editar evento" /><EventForm id={id} /></>);
}
