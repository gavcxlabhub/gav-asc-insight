import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

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
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Agentes"
      description="Desempenho individual da equipe de atendimento."
      icon={Users}
      nota="Os indicadores de produtividade por agente serão construídos nesta área."
    />
  ),
});
