import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — GAV ASC Analytics" },
      {
        name: "description",
        content: "Análise dos serviços demandados nos atendimentos WhatsApp da GAV Resorts.",
      },
      { property: "og:title", content: "Serviços — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Análise dos serviços demandados nos atendimentos WhatsApp.",
      },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Serviços"
      description="Demanda por tipo de serviço e sua evolução ao longo do período."
      icon={Wrench}
      nota="Os rankings e séries por serviço serão construídos nesta área."
    />
  ),
});
