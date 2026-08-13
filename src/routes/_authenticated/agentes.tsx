import { createFileRoute } from "@tanstack/react-router";

import { DimensaoPage } from "@/components/dimensao-page";

export const Route = createFileRoute("/_authenticated/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes — GAV ASC Analytics" },
      {
        name: "description",
        content: "Produtividade e tempos de resposta por agente nos atendimentos WhatsApp.",
      },
      { property: "og:title", content: "Agentes — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Produtividade e tempos de resposta por agente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <DimensaoPage
      titulo="Agentes"
      descricao="Desempenho individual da equipe de atendimento."
      dimensao="agente"
      rotuloColuna="Agente"
      excluirVazios
    />
  ),
});
