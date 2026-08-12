import { createFileRoute } from "@tanstack/react-router";
import { Repeat2 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/recorrencia")({
  head: () => ({
    meta: [
      { title: "Recorrência — GAV ASC Analytics" },
      {
        name: "description",
        content: "Análise de recorrência de contatos nos atendimentos WhatsApp da GAV Resorts.",
      },
      { property: "og:title", content: "Recorrência — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Análise de recorrência de contatos nos atendimentos WhatsApp.",
      },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Recorrência"
      description="Comportamento de retorno dos contatos, preservando a recorrência original da ASC."
      icon={Repeat2}
      nota="Os indicadores de recorrência serão construídos nesta área a partir do campo original da ASC."
    />
  ),
});
