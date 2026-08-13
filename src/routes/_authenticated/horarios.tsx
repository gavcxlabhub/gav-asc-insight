import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { HorariosView } from "@/components/horarios-view";

export const Route = createFileRoute("/_authenticated/horarios")({
  head: () => ({
    meta: [
      { title: "Horários de Pico — GAV ASC Analytics" },
      {
        name: "description",
        content: "Distribuição dos atendimentos WhatsApp por hora e dia da semana.",
      },
      { property: "og:title", content: "Horários de Pico — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Distribuição dos atendimentos WhatsApp por hora e dia da semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HorariosPage,
});

function HorariosPage() {
  const { state, setState, filters } = useDashboardFilters();
  return (
    <>
      <PageHeader
        title="Horários de Pico"
        description="Concentração da demanda por faixa horária e dia da semana."
      />
      <Filters state={state} onChange={setState} />
      <HorariosView filters={filters} />
    </>
  );
}
