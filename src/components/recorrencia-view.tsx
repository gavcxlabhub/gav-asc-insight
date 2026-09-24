import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { FrequenciaContatos } from "@/components/frequencia-contatos";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AXIS_TICK,
  AnalyticsChartCard,
  CHART_COLORS,
  CHART_TOOLTIP,
} from "@/components/analytics-chart-card";
import {
  kpisQuery,
  recorrenciaDimensaoQuery,
  recorrenciaPeriodoQuery,
  type DashboardFilters,
  type DimensaoDetalhe,
  type Granularidade,
  type TipoRecorrencia,
} from "@/lib/dashboard-queries";

function CardRecorrencia({
  titulo,
  valor,
  valorAsc,
  total,
  loading,
  filters,
}: {
  titulo: string;
  valor: number;
  valorAsc: number;
  total: number;
  loading: boolean;
  filters: DashboardFilters;
}) {
  const pct = total ? (valor / total) * 100 : 0;
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <ExportButton
          compact
          filename={`gav-${titulo}-${exportDateSuffix()}`}
          sheetName={titulo}
          fetchData={() =>
            withDashboardFilters(filters, [
              {
                Indicador: titulo,
                "Sistema": valor,
                "% do total": Number(pct.toFixed(2)),
                "ASC informa": valorAsc,
                "Total do período": total,
              },
            ])
          }
        />
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {valor.toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pct.toFixed(1).replace(".", ",")}% do total (sistema)
          </p>
          <p className="mt-0.5 text-xs text-amber-400/80">
            ASC informa: {valorAsc.toLocaleString("pt-BR")}
          </p>
        </>
      )}
    </div>
  );
}

function RankingRecorrencia({
  titulo,
  filters,
  dimensao,
  tipo,
}: {
  titulo: string;
  filters: DashboardFilters;
  dimensao: DimensaoDetalhe;
  tipo: TipoRecorrencia;
}) {
  const { data, isPending } = useQuery(recorrenciaDimensaoQuery(filters, dimensao, tipo, 10));
  const dados = (data ?? []).filter(
    (d) => d.com_recorrencia > 0 && !(dimensao === "agente" && d.rotulo === "Sem agente"),
  );
  return (
    <AnalyticsChartCard
      titulo={titulo}
      loading={isPending}
      vazio={dados.length === 0}
      altura={Math.max(280, dados.length * 30)}
      exportRows={withDashboardFilters(
        filters,
        dados.map((d) => ({
          Ranking: d.rotulo,
          "Total atendimentos": Number(d.total),
          Ocorrências: Number(d.com_recorrencia),
          Percentual: Number(d.percentual ?? 0),
        })),
      )}
      exportFilename={`gav-${titulo}-${exportDateSuffix()}`}
    >
      <BarChart data={dados} layout="vertical" margin={{ left: 12, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
        <XAxis type="number" tick={AXIS_TICK} />
        <YAxis type="category" dataKey="rotulo" width={150} tick={AXIS_TICK} />
        <Tooltip {...CHART_TOOLTIP} />
        <Bar
          dataKey="com_recorrencia"
          name="Ocorrências"
          fill={CHART_COLORS.gold}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </AnalyticsChartCard>
  );
}

export function RecorrenciaView({ filters }: { filters: DashboardFilters }) {
  const [granularidade, setGranularidade] = useState<Granularidade>("dia");
  const kpis = useQuery(kpisQuery(filters));
  const evolucao = useQuery(recorrenciaPeriodoQuery(filters, granularidade));

  const total = kpis.data?.total ?? 0;
  const serie = evolucao.data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <CardRecorrencia
          titulo="Rechamadas"
          valor={kpis.data?.sys_rechamadas ?? 0}
          valorAsc={kpis.data?.asc_rechamadas ?? 0}
          total={total}
          loading={kpis.isPending}
          filters={filters}
        />
        <CardRecorrencia
          titulo="Recorrentes"
          valor={kpis.data?.sys_recorrentes ?? 0}
          valorAsc={kpis.data?.asc_recorrentes ?? 0}
          total={total}
          loading={kpis.isPending}
          filters={filters}
        />
        <CardRecorrencia
          titulo="Reincidentes"
          valor={kpis.data?.sys_reincidentes ?? 0}
          valorAsc={kpis.data?.asc_reincidentes ?? 0}
          total={total}
          loading={kpis.isPending}
          filters={filters}
        />
      </div>

      <AnalyticsChartCard
        titulo="Evolução da recorrência"
        loading={evolucao.isPending}
        vazio={serie.length === 0}
        altura={320}
        exportRows={withDashboardFilters(
          filters,
          serie.map((d) => ({
            Período: d.periodo,
            Rechamadas: Number(d.rechamadas),
            Recorrentes: Number(d.recorrentes),
            Reincidentes: Number(d.reincidentes),
          })),
        )}
        exportFilename={`gav-evolucao-recorrencia-${exportDateSuffix()}`}
        acoes={
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={granularidade === "dia" ? "default" : "outline"}
              onClick={() => setGranularidade("dia")}
            >
              Dia
            </Button>
            <Button
              size="sm"
              variant={granularidade === "mes" ? "default" : "outline"}
              onClick={() => setGranularidade("mes")}
            >
              Mês
            </Button>
          </div>
        }
      >
        <LineChart data={serie} margin={{ left: 4, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="periodo" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip {...CHART_TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#A9B4C4" }} />
          <Line
            type="monotone"
            dataKey="rechamadas"
            name="Rechamada"
            stroke={CHART_COLORS.gold}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="recorrentes"
            name="Recorrente"
            stroke={CHART_COLORS.muted}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="reincidentes"
            name="Reincidente"
            stroke={CHART_COLORS.goldDark}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </AnalyticsChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingRecorrencia
          titulo="Top 10 contas — Rechamada"
          filters={filters}
          dimensao="conta"
          tipo="rechamada"
        />
        <RankingRecorrencia
          titulo="Top 10 contas — Reincidência"
          filters={filters}
          dimensao="conta"
          tipo="reincid"
        />
        <RankingRecorrencia
          titulo="Top 10 serviços — Rechamada"
          filters={filters}
          dimensao="servico"
          tipo="rechamada"
        />
        <RankingRecorrencia
          titulo="Top 10 serviços — Reincidência"
          filters={filters}
          dimensao="servico"
          tipo="reincid"
        />
        <RankingRecorrencia
          titulo="Top 10 agentes — Rechamada"
          filters={filters}
          dimensao="agente"
          tipo="rechamada"
        />
        <RankingRecorrencia
          titulo="Top 10 agentes — Reincidência"
          filters={filters}
          dimensao="agente"
          tipo="reincid"
        />
      </div>

      <FrequenciaContatos filters={filters} />
    </div>
  );
}
