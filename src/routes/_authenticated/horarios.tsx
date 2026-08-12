import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/horarios")({
  head: () => ({
    meta: [
      { title: "Horários de Pico — GAV ASC Analytics" },
      {
        name: "description",
        content: "Distribuição dos atendimentos WhatsApp por hora e dia da semana.",
      },
      { property: "og:title", content: "Horários de Pico — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Distribuição dos atendimentos WhatsApp por hora e dia da semana.",
      },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Horários de Pico"
      description="Concentração da demanda por faixa horária e dia da semana."
      icon={Clock}
      nota="O mapa de calor de horários será construído nesta área."
    />
  ),
});
