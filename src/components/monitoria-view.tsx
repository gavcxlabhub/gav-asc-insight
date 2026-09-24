import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatarDuracao,
  monitoriaAgentesQuery,
  type DashboardFilters,
  type MonitoriaAgente,
} from "@/lib/dashboard-queries";

function Destaque({
  titulo,
  agente,
  valor,
  detalhe,
}: {
  titulo: string;
  agente?: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-2 font-display text-2xl font-bold text-foreground">{valor}</p>
      <p className="mt-1 truncate text-sm font-medium">{agente ?? "—"}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function Ranking({
  titulo,
  rows,
  valor,
  subvalor,
}: {
  titulo: string;
  rows: MonitoriaAgente[];
  valor: (row: MonitoriaAgente) => string;
  subvalor?: (row: MonitoriaAgente) => string;
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
      </div>
      <div>
        {rows.map((row, index) => (
          <div
            key={row.agente}
            className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <span className="mr-2 text-xs text-muted-foreground">{index + 1}º</span>
                {row.agente}
              </p>
              {subvalor ? <p className="mt-0.5 text-xs text-muted-foreground">{subvalor(row)}</p> : null}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{valor(row)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonitoriaView({ filters }: { filters: DashboardFilters }) {
  const query = useQuery(monitoriaAgentesQuery(filters, 20));
  const pct = (v: number | null | undefined) =>
    `${Number(v ?? 0).toFixed(1).replace(".", ",")}%`;
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

  const dados = useMemo(() => {
    const rows = query.data ?? [];
    const by = (getter: (r: MonitoriaAgente) => number) =>
      [...rows].sort((a, b) => getter(b) - getter(a));

    return {
      volume: by((r) => r.atendimentos_humanos),
      tma: by((r) => r.tma_segundos ?? 0),
      rechamada: by((r) => r.pct_rechamada),
      reincidencia: by((r) => r.pct_reincidencia),
      inatividade: by((r) => r.pct_inatividade),
      transferencia: by((r) => r.pct_transferencia),
    };
  }, [query.data]);

  if (query.isPending) return <Skeleton className="h-[620px] w-full" />;

  if (query.isError) {
    return (
      <div className="surface border border-red-500/40 p-5 text-sm text-red-200">
        Não foi possível carregar os pontos de atenção.{" "}
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

  const maiorTma = dados.tma[0];
  const maiorRechamada = dados.rechamada[0];
  const maiorReincidencia = dados.reincidencia[0];
  const maiorInatividade = dados.inatividade[0];
  const maiorTransferencia = dados.transferencia[0];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-muted-foreground">
        Esta página não atribui nota ao consultor. Ela destaca <strong>sinais objetivos para direcionar amostras de monitoria</strong>.
        Rankings de taxa consideram somente agentes com pelo menos 20 atendimentos Humano + Misto no período.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Destaque
          titulo="Maior TMA"
          agente={maiorTma?.agente}
          valor={formatarDuracao(maiorTma?.tma_segundos)}
          detalhe={`${n(maiorTma?.atendimentos_humanos)} atendimentos`}
        />
        <Destaque
          titulo="Maior % Rechamada"
          agente={maiorRechamada?.agente}
          valor={pct(maiorRechamada?.pct_rechamada)}
          detalhe={`${n(maiorRechamada?.rechamadas)} rechamadas`}
        />
        <Destaque
          titulo="Maior % Reincidência"
          agente={maiorReincidencia?.agente}
          valor={pct(maiorReincidencia?.pct_reincidencia)}
          detalhe={`${n(maiorReincidencia?.reincidentes)} reincidências`}
        />
        <Destaque
          titulo="Maior % Inatividade"
          agente={maiorInatividade?.agente}
          valor={pct(maiorInatividade?.pct_inatividade)}
          detalhe={`${n(maiorInatividade?.inatividade)} finalizações`}
        />
        <Destaque
          titulo="Maior % Transferência"
          agente={maiorTransferencia?.agente}
          valor={pct(maiorTransferencia?.pct_transferencia)}
          detalhe={`${n(maiorTransferencia?.transferidos)} transferências`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Ranking
          titulo="Top volume para amostragem"
          rows={dados.volume.slice(0, 10)}
          valor={(r) => n(r.atendimentos_humanos)}
          subvalor={(r) => `TMA ${formatarDuracao(r.tma_segundos)}`}
        />
        <Ranking
          titulo="Maior TMA"
          rows={dados.tma.slice(0, 10)}
          valor={(r) => formatarDuracao(r.tma_segundos)}
          subvalor={(r) => `${n(r.atendimentos_humanos)} atendimentos humanos`}
        />
        <Ranking
          titulo="Maior taxa de Rechamada"
          rows={dados.rechamada.slice(0, 10)}
          valor={(r) => pct(r.pct_rechamada)}
          subvalor={(r) => `${n(r.rechamadas)} rechamadas de ${n(r.atendimentos_humanos)} atendimentos`}
        />
        <Ranking
          titulo="Maior taxa de Reincidência"
          rows={dados.reincidencia.slice(0, 10)}
          valor={(r) => pct(r.pct_reincidencia)}
          subvalor={(r) => `${n(r.reincidentes)} reincidências de ${n(r.atendimentos_humanos)} atendimentos`}
        />
        <Ranking
          titulo="Maior finalização por inatividade"
          rows={dados.inatividade.slice(0, 10)}
          valor={(r) => pct(r.pct_inatividade)}
          subvalor={(r) => `${n(r.inatividade)} casos`}
        />
        <Ranking
          titulo="Maior taxa de transferência"
          rows={dados.transferencia.slice(0, 10)}
          valor={(r) => pct(r.pct_transferencia)}
          subvalor={(r) => `${n(r.transferidos)} transferências`}
        />
      </div>
    </div>
  );
}
