import { createFileRoute } from "@tanstack/react-router";

import { DimensaoPage } from "@/components/dimensao-page";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({
    meta: [
      { title: "Contas e Departamentos — GAV ASC Analytics" },
      {
        name: "description",
        content: "Volume e desempenho de atendimentos por conta e departamento da GAV Resorts.",
      },
      { property: "og:title", content: "Contas e Departamentos — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Volume e desempenho de atendimentos por conta e departamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <DimensaoPage
      titulo="Contas / Departamentos"
      descricao="Distribuição dos atendimentos entre as contas e departamentos da operação."
      dimensao="conta"
      rotuloColuna="Conta"
    />
  ),
});
