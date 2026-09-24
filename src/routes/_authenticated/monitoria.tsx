import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { MonitoriaView } from "@/components/monitoria-view";

export const Route = createFileRoute("/_authenticated/monitoria")({
  head: () => ({
    meta: [
      { title: "Monitoria — GAV ASC Analytics" },
      {
        name: "description",
        content: "Pontos de atenção para direcionamento de monitorias da operação ASC.",
      },
      { property: "og:title", content: "Monitoria — GAV ASC Analytics" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MonitoriaPage,
});

function MonitoriaPage() {
  const { state, setState, filters } = useDashboardFilters();

  return (
    <>
      <PageHeader
        title="Monitoria"
        description="Pontos de atenção para direcionar amostras de monitoria com base em indicadores objetivos."
      />
      <Filters state={state} onChange={setState} />
      <MonitoriaView filters={filters} />
    </>
  );
}
