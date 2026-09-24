import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import {
  AXIS_TICK,
  AnalyticsChartCard,
  CHART_COLORS,
  CHART_TOOLTIP,
} from "@/components/analytics-chart-card";
import { agrupadoQuery, heatmapQuery, type DashboardFilters } from "@/lib/dashboard-queries";

const DIAS: { id: string; label: string }[] = [
  { id: "1", label: "Seg" },
  { id: "2", label: "Ter" },
  { id: "3", label: "Qua" },
  { id: "4", label: "Qui" },
  { id: "5", label: "Sex" },
  { id: "6", label: "Sáb" },
  { id: "7", label: "Dom" },
];

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function Heatmap({ filters }: { filters: DashboardFilters }) {
  const { data, isPending } = useQuery(heatmapQuery(filters));
  const celulas = data ?? [];
  const mapa = new Map(celulas.map((c) => [`${c.dia_semana}-${c.hora}`, c.total]));
  const max = celulas.reduce((m, c) => Math.max(m, c.total), 0);

  return (
    <div className="surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-foreground">
          Mapa de calor — dia da semana × hora
        </h3>
        <ExportButton
          compact
          filename={`gav-mapa-calor-${exportDateSuffix()}`}
          sheetName="Mapa de calor"
          fetchData={() =>
            withDashboardFilters(
              filters,
              celulas.map((row) => ({
                "Dia da semana": DIAS.find((d) => d.id === row.dia_semana)?.label ?? row.dia_semana,
                Hora: `${row.hora}h`,
                Atendimentos: Number(row.total),
              })),
            )
          }
        />
      </div>
      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : celulas.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Sem dados no período e filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="mb-1 flex gap-[2px] pl-10">
              {HORAS.map((h) => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {h}
                </div>
              ))}
            </div>
            {DIAS.map((d) => (
              <div key={d.id} className="mb-[2px] flex items-center gap-[2px]">
                <div className="w-10 shrink-0 text-[11px] text-muted-foreground">{d.label}</div>
                {HORAS.map((h) => {
                  const total = mapa.get(`${d.id}-${h}`) ?? 0;
                  const intensidade = max ? total / max : 0;
                  return (
                    <div
                      key={h}
                      title={`${d.label} · ${h}h · ${total.toLocaleString("pt-BR")} atendimentos`}
                      className="h-7 flex-1 rounded-[3px] border border-border/60"
                      style={{
                        backgroundColor:
                          total === 0
                            ? "transparent"
                            : `color-mix(in srgb, ${CHART_COLORS.goldDark} ${Math.round(
                                20 + intensidade * 80,
                              )}%, transparent)`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Menor</span>
              <div className="h-2 w-32 rounded-full bg-gradient-to-r from-transparent to-[#B8935A]" />
              <span>Maior · pico {max.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HorariosView({ filters }: { filters: DashboardFilters }) {
  const horas = useQuery(agrupadoQuery(filters, "hora", 24));
  const semana = useQuery(agrupadoQuery(filters, "dia_semana", 7));

  const dadosHora = HORAS.map((h) => ({
    hora: `${h}h`,
    total: horas.data?.find((d) => d.rotulo === h)?.total ?? 0,
  }));
  const dadosSemana = DIAS.map((d) => ({
    dia: d.label,
    total: semana.data?.find((s) => s.rotulo === d.id)?.total ?? 0,
  }));

  const semHora = (horas.data ?? []).length === 0;
  const semSemana = (semana.data ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartCard
          titulo="Volume por hora do dia"
          loading={horas.isPending}
          vazio={semHora}
          altura={300}
          exportRows={withDashboardFilters(
            filters,
            dadosHora.map((row) => ({ Hora: row.hora, Atendimentos: Number(row.total) })),
          )}
          exportFilename={`gav-volume-hora-${exportDateSuffix()}`}
        >
          <LineChart data={dadosHora} margin={{ left: 4, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="hora" tick={AXIS_TICK} interval={1} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip {...CHART_TOOLTIP} />
            <Line
              type="monotone"
              dataKey="total"
              name="Atendimentos"
              stroke={CHART_COLORS.gold}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </AnalyticsChartCard>

        <AnalyticsChartCard
          titulo="Volume por dia da semana"
          loading={semana.isPending}
          vazio={semSemana}
          altura={300}
          exportRows={withDashboardFilters(
            filters,
            dadosSemana.map((row) => ({ "Dia da semana": row.dia, Atendimentos: Number(row.total) })),
          )}
          exportFilename={`gav-volume-dia-semana-${exportDateSuffix()}`}
        >
          <BarChart data={dadosSemana} margin={{ left: 4, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="dia" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar
              dataKey="total"
              name="Atendimentos"
              fill={CHART_COLORS.gold}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </AnalyticsChartCard>
      </div>

      <Heatmap filters={filters} />
    </div>
  );
}
