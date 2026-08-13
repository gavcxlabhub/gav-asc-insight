import { createFileRoute } from "@tanstack/react-router";

import { DimensaoPage } from "@/components/dimensao-page";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <DimensaoPage
      titulo="Serviços"
      descricao="Demanda por tipo de serviço e sua evolução ao longo do período."
      dimensao="servico"
      rotuloColuna="Serviço"
    />
  ),
});
