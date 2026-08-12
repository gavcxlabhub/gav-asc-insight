import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import {
  formatarDuracao,
  kpisQuery,
  percentual,
  type DashboardFilters,
} from "@/lib/dashboard-queries";

interface CardProps {
  titulo: string;
  valor: string;
  detalhe?: string;
  loading: boolean;
}

function KpiCard({ titulo, valor, detalhe, loading }: CardProps) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{valor}</p>
          {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
        </>
      )}
    </div>
  );
}

export function KpiCards({ filters }: { filters: DashboardFilters }) {
  const { data, isPending } = useQuery(kpisQuery(filters));
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
  const total = data?.total ?? 0;
  const automacao = total ? ((data?.automaticos ?? 0) / total) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard titulo="Total de atendimentos" valor={n(total)} loading={isPending} />
      <KpiCard
        titulo="Humanos / Mistos / Automáticos"
        valor={`${n(data?.humanos)} / ${n(data?.mistos)} / ${n(data?.automaticos)}`}
        loading={isPending}
      />
      <KpiCard
        titulo="% Automação"
        valor={`${automacao.toFixed(1).replace(".", ",")}%`}
        detalhe={`${n(data?.automaticos)} atendimentos automáticos`}
        loading={isPending}
      />
      <KpiCard
        titulo="Ativos / Receptivos"
        valor={`${n(data?.ativos)} / ${n(data?.receptivos)}`}
        loading={isPending}
      />
      <KpiCard
        titulo="TME médio"
        valor={formatarDuracao(data?.tme_segundos)}
        detalhe="Tempo médio em fila"
        loading={isPending}
      />
      <KpiCard
        titulo="TMA médio"
        valor={formatarDuracao(data?.tma_segundos)}
        detalhe="Tempo médio de atendimento"
        loading={isPending}
      />
      <KpiCard
        titulo="Primeira resposta"
        valor={formatarDuracao(data?.tpr_segundos)}
        detalhe="Da fila até a 1ª mensagem do agente"
        loading={isPending}
      />
      <KpiCard
        titulo="Rechamadas"
        valor={n(data?.rechamadas)}
        detalhe={`${percentual(data?.rechamadas ?? 0, total)} do período`}
        loading={isPending}
      />
      <KpiCard
        titulo="Recorrentes"
        valor={n(data?.recorrentes)}
        detalhe={`${percentual(data?.recorrentes ?? 0, total)} do período`}
        loading={isPending}
      />
      <KpiCard
        titulo="Reincidentes"
        valor={n(data?.reincidentes)}
        detalhe={`${percentual(data?.reincidentes ?? 0, total)} do período`}
        loading={isPending}
      />
    </div>
  );
}
