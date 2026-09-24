import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import {
  formatarDuracao,
  monitoriaAgentesQuery,
  type DashboardFilters,
  type MonitoriaAgente,
} from "@/lib/dashboard-queries";

function TopLista({
  titulo,
  rows,
  valor,
  filters,
}: {
  titulo: string;
  rows: MonitoriaAgente[];
  valor: (row: MonitoriaAgente) => string;
  filters: DashboardFilters;
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
        <ExportButton
          compact
          filename={`gav-agentes-${titulo}-${exportDateSuffix()}`}
          sheetName={titulo}
          fetchData={() =>
            withDashboardFilters(
              filters,
              rows.map((row, index) => ({
                Posição: index + 1,
                Agente: row.agente,
                "Atendimentos humanos": row.atendimentos_humanos,
                TMA: formatarDuracao(row.tma_segundos),
                Rechamadas: row.rechamadas,
                "% Rechamada": row.pct_rechamada,
                Reincidências: row.reincidentes,
                "% Reincidência": row.pct_reincidencia,
                Recorrências: row.recorrentes,
                "% Recorrência": row.pct_recorrencia,
                Inatividade: row.inatividade,
                "% Inatividade": row.pct_inatividade,
                Transferências: row.transferidos,
                "% Transferência": row.pct_transferencia,
              })),
            )
          }
        />
      </div>
      <div>
        {rows.map((row, index) => (
          <div
            key={row.agente}
            className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-0"
          >
            <div className="min-w-0">
              <span className="mr-2 text-xs text-muted-foreground">{index + 1}º</span>
              <span className="text-sm font-medium">{row.agente}</span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{valor(row)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentesInsights({ filters }: { filters: DashboardFilters }) {
  const query = useQuery(monitoriaAgentesQuery(filters, 20));
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
  const pct = (v: number | null | undefined) =>
    `${Number(v ?? 0).toFixed(1).replace(".", ",")}%`;

  const rankings = useMemo(() => {
    const rows = query.data ?? [];
    return {
      produtividade: [...rows].sort((a, b) => b.atendimentos_humanos - a.atendimentos_humanos).slice(0, 5),
      tma: [...rows]
        .filter((r) => r.tma_segundos != null)
        .sort((a, b) => (b.tma_segundos ?? 0) - (a.tma_segundos ?? 0))
        .slice(0, 5),
      rechamada: [...rows].sort((a, b) => b.pct_rechamada - a.pct_rechamada).slice(0, 5),
      reincidencia: [...rows].sort((a, b) => b.pct_reincidencia - a.pct_reincidencia).slice(0, 5),
    };
  }, [query.data]);

  if (query.isPending) return <Skeleton className="h-[520px] w-full" />;

  if (query.isError) {
    return (
      <div className="surface border border-red-500/40 p-5 text-sm text-red-200">
        Não foi possível carregar os indicadores dos agentes.{" "}
        {query.error instanceof Error ? query.error.message : "Erro na consulta."}
      </div>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-muted-foreground">
        Não há agentes com pelo menos 20 atendimentos humanos no período e filtros selecionados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Produtividade considera apenas atendimentos <strong>Humano + Misto</strong>. Rankings de taxa usam
        somente agentes com pelo menos 20 atendimentos humanos no período para reduzir distorções por baixo volume.
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TopLista
          titulo="Top produtividade humana"
          rows={rankings.produtividade}
          filters={filters}
          valor={(r) => `${n(r.atendimentos_humanos)} atend.`}
        />
        <TopLista
          titulo="Maiores TMA"
          rows={rankings.tma}
          filters={filters}
          valor={(r) => formatarDuracao(r.tma_segundos)}
        />
        <TopLista
          titulo="Maiores taxas de Rechamada"
          rows={rankings.rechamada}
          filters={filters}
          valor={(r) => pct(r.pct_rechamada)}
        />
        <TopLista
          titulo="Maiores taxas de Reincidência"
          rows={rankings.reincidencia}
          filters={filters}
          valor={(r) => pct(r.pct_reincidencia)}
        />
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">Visão consolidada por agente</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorrência usa o cálculo do sistema por telefone.
            </p>
          </div>
          <ExportButton
            compact
            filename={`gav-visao-agentes-${exportDateSuffix()}`}
            sheetName="Visão por agente"
            fetchData={() =>
              withDashboardFilters(
                filters,
                rows.map((row) => ({
                  Agente: row.agente,
                  Produtividade: row.atendimentos_humanos,
                  TMA: formatarDuracao(row.tma_segundos),
                  Rechamadas: row.rechamadas,
                  "% Rechamada": row.pct_rechamada,
                  Reincidências: row.reincidentes,
                  "% Reincidência": row.pct_reincidencia,
                  Recorrências: row.recorrentes,
                  "% Recorrência": row.pct_recorrencia,
                  Inatividade: row.inatividade,
                  "% Inatividade": row.pct_inatividade,
                  Transferências: row.transferidos,
                  "% Transferência": row.pct_transferencia,
                })),
              )
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 text-right font-medium">Produtividade</th>
                <th className="px-4 py-3 text-right font-medium">TMA</th>
                <th className="px-4 py-3 text-right font-medium">Rechamadas</th>
                <th className="px-4 py-3 text-right font-medium">% Rechamada</th>
                <th className="px-4 py-3 text-right font-medium">Reincidências</th>
                <th className="px-4 py-3 text-right font-medium">% Reincidência</th>
                <th className="px-4 py-3 text-right font-medium">% Inatividade</th>
                <th className="px-4 py-3 text-right font-medium">% Transferência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agente} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{row.agente}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{n(row.atendimentos_humanos)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatarDuracao(row.tma_segundos)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{n(row.rechamadas)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(row.pct_rechamada)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{n(row.reincidentes)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(row.pct_reincidencia)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(row.pct_inatividade)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(row.pct_transferencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
