import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ImportDialog } from "@/components/import-dialog";
import { useAuth } from "@/hooks/use-auth";
import { periodoBaseQuery, totalAtendimentosQuery } from "@/lib/analytics-queries";

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
    ],
  }),
  component: VisaoExecutiva,
});

function VisaoExecutiva() {
  const { isAdmin, user } = useAuth();
  const total = useQuery(totalAtendimentosQuery());
  const periodo = useQuery({ ...periodoBaseQuery(), enabled: (total.data ?? 0) > 0 });

  const temBase = (total.data ?? 0) > 0;

  const formatar = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  return (
    <>
      <PageHeader
        title="Visão Executiva"
        description="Panorama consolidado dos atendimentos WhatsApp via plataforma ASC."
        actions={isAdmin && user ? <ImportDialog userId={user.id} /> : null}
      />

      {!temBase ? (
        <EmptyState
          action={
            isAdmin && user ? <ImportDialog userId={user.id} /> : (
              <p className="text-xs text-muted-foreground">
                Solicite a um administrador a importação da base.
              </p>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total de atendimentos
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {(total.data ?? 0).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Período inicial</p>
            <p className="mt-2 text-3xl font-semibold">{formatar(periodo.data?.inicio)}</p>
          </div>
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Período final</p>
            <p className="mt-2 text-3xl font-semibold">{formatar(periodo.data?.fim)}</p>
          </div>
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ferramenta</p>
            <p className="mt-2 text-3xl font-semibold">ASC</p>
          </div>
          <div className="surface col-span-full p-6 text-sm text-muted-foreground">
            Indicadores executivos detalhados serão construídos nesta área nas próximas etapas.
          </div>
        </div>
      )}
    </>
  );
}
