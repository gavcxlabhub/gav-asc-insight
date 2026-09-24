import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { AgentesInsights } from "@/components/agentes-insights";

export const Route = createFileRoute("/_authenticated/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes — GAV ASC Analytics" },
      {
        name: "description",
        content: "Produtividade, TMA, rechamadas e reincidências por agente.",
      },
      { property: "og:title", content: "Agentes — GAV ASC Analytics" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AgentesPage,
});

function AgentesPage() {
  const { state, setState, filters } = useDashboardFilters();

  return (
    <>
      <PageHeader
        title="Agentes"
        description="Produtividade humana e indicadores de acompanhamento por consultor."
      />
      <Filters state={state} onChange={setState} />
      <AgentesInsights filters={filters} />
    </>
  );
}
