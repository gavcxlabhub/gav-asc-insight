import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ImportDialog } from "@/components/import-dialog";
import { Filters, useDashboardFilters } from "@/components/filters";
import { KpiCards } from "@/components/kpi-cards";
import { DashboardCharts } from "@/components/dashboard-charts";
import { AtendimentosTable } from "@/components/atendimentos-table";
import { useAuth } from "@/hooks/use-auth";
import { totalAtendimentosQuery } from "@/lib/analytics-queries";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão Executiva — GAV ASC Analytics" },
      {
        name: "description",
        content:
          "Painel executivo dos atendimentos WhatsApp da GAV Resorts consolidados da plataforma ASC.",
      },
      { property: "og:title", content: "Visão Executiva — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Painel executivo dos atendimentos WhatsApp da GAV Resorts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisaoExecutiva,
});

function VisaoExecutiva() {
  const { isAdmin, user } = useAuth();
  const total = useQuery(totalAtendimentosQuery());
  const { state, setState, filters } = useDashboardFilters();

  const temBase = (total.data ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Visão Executiva"
        description="Panorama consolidado dos atendimentos WhatsApp via plataforma ASC."
        actions={isAdmin && user ? <ImportDialog userId={user.id} /> : null}
      />

      {!total.isPending && !temBase ? (
        <EmptyState
          action={
            isAdmin && user ? (
              <ImportDialog userId={user.id} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Solicite a um administrador a importação da base.
              </p>
            )
          }
        />
      ) : (
        <>
          <Filters state={state} onChange={setState} />
          <KpiCards filters={filters} />
          <DashboardCharts filters={filters} />
          <AtendimentosTable filters={filters} />
        </>
      )}
    </>
  );
}
