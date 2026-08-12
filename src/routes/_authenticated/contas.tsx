import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

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
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Contas / Departamentos"
      description="Distribuição dos atendimentos entre as contas e departamentos da operação."
      icon={Building2}
      nota="A visão comparativa por conta será construída nesta área."
    />
  ),
});
