import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { RecorrenciaView } from "@/components/recorrencia-view";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecorrenciaPage,
});

function RecorrenciaPage() {
  const { state, setState, filters } = useDashboardFilters();
  return (
    <>
      <PageHeader
        title="Recorrência"
        description="Comportamento de retorno dos contatos: cálculo do sistema, referência da ASC e frequência por cliente."
      />
      <Filters state={state} onChange={setState} />
      <RecorrenciaView filters={filters} />
    </>
  );
}
