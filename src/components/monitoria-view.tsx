import { useMemo, useState } from "react";
import { Info } from "lucide-react";
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

function InfoHint({ texto, label }: { texto: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Informação sobre ${label}`}
        className="text-muted-foreground transition-colors hover:text-foreground"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-6 z-50 w-72 rounded-lg border border-border bg-[#1C324B] p-3 text-xs leading-relaxed text-[#F3EEDF] shadow-xl">
          <div className="absolute -top-1.5 right-1 size-3 rotate-45 border-l border-t border-border bg-[#1C324B]" />
          {texto}
        </div>
      ) : null}
    </div>
  );
}

function Destaque({
  titulo,
  agente,
  valor,
  detalhe,
  tooltip,
  filters,
}: {
  titulo: string;
  agente?: string;
  valor: string;
  detalhe?: string;
  tooltip: string;
  filters: DashboardFilters;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <div className="flex items-center gap-2">
          <ExportButton
            compact
            filename={`gav-monitoria-${titulo}-${exportDateSuffix()}`}
            sheetName={titulo}
            fetchData={() =>
              withDashboardFilters(filters, [
                {
                  Indicador: titulo,
                  Agente: agente ?? "",
                  Valor: valor,
                  Detalhe: detalhe ?? "",
                },
              ])
            }
          />
          <InfoHint texto={tooltip} label={titulo} />
        </div>
      </div>
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
  tooltip,
  filters,
}: {
  titulo: string;
  rows: MonitoriaAgente[];
  valor: (row: MonitoriaAgente) => string;
  subvalor?: (row: MonitoriaAgente) => string;
  tooltip: string;
  filters: DashboardFilters;
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
        <div className="flex items-center gap-2">
          <ExportButton
            compact
            filename={`gav-monitoria-${titulo}-${exportDateSuffix()}`}
            sheetName={titulo}
            fetchData={() =>
              withDashboardFilters(
                filters,
                rows.map((row, index) => ({
                  Posição: index + 1,
                  Agente: row.agente,
                  "Atendimentos humanos": row.atendimentos_humanos,
                  "TMA": formatarDuracao(row.tma_segundos),
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
          <InfoHint texto={tooltip} label={titulo} />
        </div>
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
  const query = useQuery(monitoriaAgentesQuery(filters, 1));
  const pct = (v: number | null | undefined) =>
    `${Number(v ?? 0).toFixed(1).replace(".", ",")}%`;
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

  const dados = useMemo(() => {
    const rows = query.data ?? [];
    const elegiveisTaxa = rows.filter((r) => r.atendimentos_humanos >= 20);
    const by = (lista: MonitoriaAgente[], getter: (r: MonitoriaAgente) => number) =>
      [...lista].sort((a, b) => getter(b) - getter(a));

    return {
      todos: rows,
      elegiveisTaxa,
      volume: by(rows, (r) => r.atendimentos_humanos),
      tma: by(elegiveisTaxa, (r) => r.tma_segundos ?? 0),
      rechamada: by(elegiveisTaxa, (r) => r.pct_rechamada),
      reincidencia: by(elegiveisTaxa, (r) => r.pct_reincidencia),
      inatividade: by(elegiveisTaxa, (r) => r.pct_inatividade),
      transferencia: by(rows, (r) => r.transferidos),
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
        Não há agentes com atendimentos humanos no período e filtros selecionados.
      </div>
    );
  }

  const maiorTma = dados.tma[0];
  const maiorRechamada = dados.rechamada[0];
  const maiorReincidencia = dados.reincidencia[0];
  const maiorInatividade = dados.inatividade[0];
  const maiorTransferencia = dados.transferencia[0];
  const totalTransferencias = dados.todos.reduce((acc, row) => acc + (row.transferidos ?? 0), 0);
  const participacaoTransferencias = (row?: MonitoriaAgente) =>
    totalTransferencias > 0 ? ((row?.transferidos ?? 0) / totalTransferencias) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-muted-foreground">
        Esta página não atribui nota ao consultor. Ela destaca <strong>sinais objetivos para direcionar amostras de monitoria</strong>.
        Rankings de taxa consideram somente agentes com pelo menos 20 atendimentos Humano + Misto no período. O ranking de transferências usa a quantidade absoluta de transferências realizadas por cada agente.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Destaque
          titulo="Maior TMA"
          agente={maiorTma?.agente}
          valor={formatarDuracao(maiorTma?.tma_segundos)}
          detalhe={`${n(maiorTma?.atendimentos_humanos)} atendimentos`}
          filters={filters}
          tooltip="Maior Tempo Médio de Atendimento entre os consultores considerados. O TMA é calculado pela duração média dos atendimentos Humano + Misto do agente no período. Não é uma nota de qualidade; serve para apontar atendimentos potencialmente mais longos para análise."
        />
        <Destaque
          titulo="Maior % Rechamada"
          agente={maiorRechamada?.agente}
          valor={pct(maiorRechamada?.pct_rechamada)}
          detalhe={`${n(maiorRechamada?.rechamadas)} rechamadas`}
          filters={filters}
          tooltip="Maior taxa de Rechamada entre os agentes com volume mínimo. Rechamada é calculada pelo sistema quando o mesmo telefone volta em menos de 24 horas. Fórmula: Rechamadas do agente ÷ Atendimentos Humano + Misto do agente × 100."
        />
        <Destaque
          titulo="Maior % Reincidência"
          agente={maiorReincidencia?.agente}
          valor={pct(maiorReincidencia?.pct_reincidencia)}
          detalhe={`${n(maiorReincidencia?.reincidentes)} reincidências`}
          filters={filters}
          tooltip="Maior taxa de Reincidência entre os agentes com volume mínimo. Reincidência é calculada pelo sistema quando o mesmo telefone volta entre 1 e 30 dias. Fórmula: Reincidências do agente ÷ Atendimentos Humano + Misto do agente × 100."
        />
        <Destaque
          titulo="Maior % Inatividade"
          agente={maiorInatividade?.agente}
          valor={pct(maiorInatividade?.pct_inatividade)}
          detalhe={`${n(maiorInatividade?.inatividade)} finalizações`}
          filters={filters}
          tooltip="Maior taxa de registros que a própria ASC marcou com Status = 'Finalizado por inatividade'. O portal não interpreta a conversa para concluir inatividade; apenas usa o status recebido da ASC. Fórmula: Finalizados por inatividade do agente ÷ Atendimentos Humano + Misto do agente × 100."
        />
        <Destaque
          titulo="Atendimentos / Transferências"
          agente={maiorTransferencia?.agente}
          valor={`${n(maiorTransferencia?.atendimentos_humanos)} / ${n(maiorTransferencia?.transferidos)}`}
          detalhe={`${participacaoTransferencias(maiorTransferencia).toFixed(1).replace(".", ",")}% de todas as transferências dos agentes`}
          filters={filters}
          tooltip="Mostra o agente com maior quantidade absoluta de transferências no período. O primeiro número é o total de atendimentos Humano + Misto do agente e o segundo é a quantidade de transferências. O ranking continua ordenado pela quantidade de transferências, não pelo volume de atendimentos."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Ranking
          titulo="Top volume para amostragem"
          rows={dados.volume.slice(0, 10)}
          valor={(r) => n(r.atendimentos_humanos)}
          subvalor={(r) => `TMA ${formatarDuracao(r.tma_segundos)}`}
          filters={filters}
          tooltip="Ordena os consultores pela quantidade de atendimentos Humano + Misto no período. É um indicador de volume produtivo, não de qualidade."
        />
        <Ranking
          titulo="Maior TMA"
          rows={dados.tma.slice(0, 10)}
          valor={(r) => formatarDuracao(r.tma_segundos)}
          subvalor={(r) => `${n(r.atendimentos_humanos)} atendimentos humanos`}
          filters={filters}
          tooltip="Ordena os consultores do maior para o menor Tempo Médio de Atendimento. O TMA considera os atendimentos Humano + Misto do agente no período."
        />
        <Ranking
          titulo="Maior taxa de Rechamada"
          rows={dados.rechamada.slice(0, 10)}
          valor={(r) => pct(r.pct_rechamada)}
          subvalor={(r) => `${n(r.rechamadas)} rechamadas de ${n(r.atendimentos_humanos)} atendimentos`}
          filters={filters}
          tooltip="Ordena pela proporção de Rechamadas. O sistema identifica Rechamada quando o mesmo telefone retorna em menos de 24 horas. Fórmula: Rechamadas ÷ Atendimentos Humano + Misto × 100."
        />
        <Ranking
          titulo="Maior taxa de Reincidência"
          rows={dados.reincidencia.slice(0, 10)}
          valor={(r) => pct(r.pct_reincidencia)}
          subvalor={(r) => `${n(r.reincidentes)} reincidências de ${n(r.atendimentos_humanos)} atendimentos`}
          filters={filters}
          tooltip="Ordena pela proporção de Reincidências. O sistema identifica Reincidência quando o mesmo telefone retorna entre 1 e 30 dias. Fórmula: Reincidências ÷ Atendimentos Humano + Misto × 100."
        />
        <Ranking
          titulo="Maior finalização por inatividade"
          rows={dados.inatividade.slice(0, 10)}
          valor={(r) => pct(r.pct_inatividade)}
          subvalor={(r) => `${n(r.inatividade)} casos`}
          filters={filters}
          tooltip="Ordena pela proporção de atendimentos que vieram da ASC com Status = 'Finalizado por inatividade'. O portal apenas contabiliza esse status; não classifica a conversa por conta própria."
        />
        <Ranking
          titulo="Quem mais transfere"
          rows={dados.transferencia.slice(0, 10)}
          valor={(r) => `${n(r.atendimentos_humanos)} / ${n(r.transferidos)}`}
          subvalor={(r) =>
            `Atendimentos / Transferências · ${participacaoTransferencias(r).toFixed(1).replace(".", ",")}% do total de transferências`
          }
          filters={filters}
          tooltip="Ordena os consultores pela quantidade total de atendimentos com Status = 'Transferido'. Aqui não usamos a taxa sobre o volume do próprio consultor. O percentual mostrado representa a participação do agente no total de transferências atribuídas aos agentes."
        />
      </div>
    </div>
  );
}
