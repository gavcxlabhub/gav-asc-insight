import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  agrupadoQuery,
  evolucaoQuery,
  recorrenciaPeriodoQuery,
  type DashboardFilters,
  type Dimensao,
  type Granularidade,
} from "@/lib/dashboard-queries";

const AZUL = "#012e59";
const DOURADO = "#c9a227";
const PALETA = [AZUL, DOURADO, "#3f6fa3", "#8a6d1f", "#7fa3c9", "#d9c26b", "#1f4a7a", "#b39434"];

const DIAS_SEMANA: Record<string, string> = {
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
  "7": "Dom",
};

interface ChartCardProps {
  titulo: string;
  loading: boolean;
  vazio: boolean;
  acoes?: ReactNode;
  children: ReactNode;
  altura?: number;
}

function ChartCard({ titulo, loading, vazio, acoes, children, altura = 280 }: ChartCardProps) {
  return (
    <div className="surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        {acoes}
      </div>
      {loading ? (
        <Skeleton style={{ height: altura }} className="w-full" />
      ) : vazio ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height: altura }}
        >
          Sem dados no período e filtros selecionados.
        </div>
      ) : (
        <div style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BarrasHorizontais({
  titulo,
  filters,
  dimensao,
  limite,
}: {
  titulo: string;
  filters: DashboardFilters;
  dimensao: Dimensao;
  limite: number;
}) {
  const { data, isPending } = useQuery(agrupadoQuery(filters, dimensao, limite));
  const dados = data ?? [];
  return (
    <ChartCard
      titulo={titulo}
      loading={isPending}
      vazio={dados.length === 0}
      altura={Math.max(280, dados.length * 26)}
    >
      <BarChart data={dados} layout="vertical" margin={{ left: 12, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="rotulo" width={150} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="total" name="Atendimentos" fill={AZUL} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  );
}

function Donut({
  titulo,
  filters,
  dimensao,
}: {
  titulo: string;
  filters: DashboardFilters;
  dimensao: Dimensao;
}) {
  const { data, isPending } = useQuery(agrupadoQuery(filters, dimensao, 12));
  const dados = (data ?? []).map((d) => ({ name: d.rotulo, value: Number(d.total) }));
  return (
    <ChartCard titulo={titulo} loading={isPending} vazio={dados.length === 0}>
      <PieChart>
        <Pie data={dados} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
          {dados.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ChartCard>
  );
}

function EvolucaoVolume({ filters }: { filters: DashboardFilters }) {
  const [granularidade, setGranularidade] = useState<Granularidade>("dia");
  const { data, isPending } = useQuery(evolucaoQuery(filters, granularidade));
  const dados = (data ?? []).map((d) => ({
    periodo: d.periodo,
    total: Number(d.total),
    humanos: Number(d.humanos),
    automaticos: Number(d.automaticos),
  }));

  return (
    <ChartCard
      titulo="Evolução do volume"
      loading={isPending}
      vazio={dados.length === 0}
      altura={320}
      acoes={
        <div className="flex gap-1">
          {(["dia", "mes"] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={granularidade === g ? "default" : "outline"}
              onClick={() => setGranularidade(g)}
            >
              {g === "dia" ? "Dia" : "Mês"}
            </Button>
          ))}
        </div>
      }
    >
      <LineChart data={dados} margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="total" name="Total" stroke={AZUL} strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="humanos"
          name="Humanos"
          stroke={DOURADO}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="automaticos"
          name="Automáticos"
          stroke="#7fa3c9"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartCard>
  );
}

function RecorrenciaPorPeriodo({ filters }: { filters: DashboardFilters }) {
  const [granularidade, setGranularidade] = useState<Granularidade>("dia");
  const { data, isPending } = useQuery(recorrenciaPeriodoQuery(filters, granularidade));
  const dados = (data ?? []).map((d) => ({
    periodo: d.periodo,
    rechamadas: Number(d.rechamadas),
    recorrentes: Number(d.recorrentes),
    reincidentes: Number(d.reincidentes),
  }));

  return (
    <ChartCard
      titulo="Recorrência por período"
      loading={isPending}
      vazio={dados.length === 0}
      altura={300}
      acoes={
        <div className="flex gap-1">
          {(["dia", "mes"] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={granularidade === g ? "default" : "outline"}
              onClick={() => setGranularidade(g)}
            >
              {g === "dia" ? "Dia" : "Mês"}
            </Button>
          ))}
        </div>
      }
    >
      <BarChart data={dados} margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="rechamadas" name="Rechamada" fill={AZUL} />
        <Bar dataKey="recorrentes" name="Recorrente" fill={DOURADO} />
        <Bar dataKey="reincidentes" name="Reincidente" fill="#7fa3c9" />
      </BarChart>
    </ChartCard>
  );
}

function VolumePorHora({ filters }: { filters: DashboardFilters }) {
  const { data, isPending } = useQuery(agrupadoQuery(filters, "hora", 24));
  const dados = (data ?? []).map((d) => ({ hora: `${d.rotulo}h`, total: Number(d.total) }));
  return (
    <ChartCard titulo="Volume por hora do dia" loading={isPending} vazio={dados.length === 0}>
      <LineChart data={dados} margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="total" name="Atendimentos" stroke={AZUL} strokeWidth={2} />
      </LineChart>
    </ChartCard>
  );
}

function VolumePorDiaSemana({ filters }: { filters: DashboardFilters }) {
  const { data, isPending } = useQuery(agrupadoQuery(filters, "dia_semana", 7));
  const dados = (data ?? []).map((d) => ({
    dia: DIAS_SEMANA[d.rotulo] ?? d.rotulo,
    total: Number(d.total),
  }));
  return (
    <ChartCard titulo="Volume por dia da semana" loading={isPending} vazio={dados.length === 0}>
      <BarChart data={dados} margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="total" name="Atendimentos" fill={DOURADO} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartCard>
  );
}

export function DashboardCharts({ filters }: { filters: DashboardFilters }) {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <EvolucaoVolume filters={filters} />
      </div>
      <BarrasHorizontais titulo="Volume por conta (top 15)" filters={filters} dimensao="conta" limite={15} />
      <BarrasHorizontais
        titulo="Volume por serviço (top 10)"
        filters={filters}
        dimensao="servico"
        limite={10}
      />
      <Donut titulo="Humano × Misto × Automático" filters={filters} dimensao="tipo" />
      <Donut titulo="Ativo × Receptivo" filters={filters} dimensao="ativo_receptivo" />
      <Donut titulo="Distribuição por status" filters={filters} dimensao="status" />
      <VolumePorHora filters={filters} />
      <VolumePorDiaSemana filters={filters} />
      <div className="xl:col-span-2">
        <RecorrenciaPorPeriodo filters={filters} />
      </div>
    </div>
  );
}
