import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import {
  filtrosRpcArgs,
  formatarDuracao,
  type DashboardFilters,
  STALE_TIME,
} from "@/lib/dashboard-queries";

export const Route = createFileRoute("/_authenticated/operacional")({
  head: () => ({
    meta: [{ title: "Operacional — GAV ASC Analytics" }],
  }),
  component: OperacionalPage,
});

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

interface IndicadoresStatus {
  total: number;
  finalizados: number;
  finalizados_inatividade: number;
  transferidos: number;
  em_atendimento: number;
  aguardando: number;
  pct_inatividade: number;
  pct_transferencia: number;
  pct_finalizados: number;
}

interface Fcr {
  total_clientes: number;
  resolvidos_primeiro_contato: number;
  retornaram_24h: number;
  fcr_percentual: number;
}

interface Interacoes {
  total: number;
  com_qic: number;
  qic_medio: number;
  qia_medio: number;
  alta_interacao: number;
}

interface ConcentracaoAgente {
  agente: string;
  total: number;
  percentual_volume: number;
  tpr_segundos: number | null;
  tma_segundos: number | null;
  pct_inatividade: number;
}

const indicadoresStatusQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["indicadores-status", f],
    staleTime: STALE_TIME,
    enabled: !!f.dataInicio && !!f.dataFim,
    queryFn: () => {
      const args = filtrosRpcArgs(f);
      delete args["p_recorrencia"];
      delete args["p_status"];
      return rpc<IndicadoresStatus>("get_indicadores_status", args);
    },
  });

const fcrQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["fcr", f],
    staleTime: STALE_TIME,
    enabled: !!f.dataInicio && !!f.dataFim,
    queryFn: () =>
      rpc<Fcr>("get_fcr", {
        p_data_inicio: f.dataInicio,
        p_data_fim: f.dataFim,
        p_conta: f.conta,
        p_tipo: f.tipo,
      }),
  });

const interacoesQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["interacoes", f],
    staleTime: STALE_TIME,
    enabled: !!f.dataInicio && !!f.dataFim,
    queryFn: () =>
      rpc<Interacoes>("get_interacoes", {
        p_data_inicio: f.dataInicio,
        p_data_fim: f.dataFim,
        p_conta: f.conta,
        p_tipo: f.tipo,
        p_ativo_receptivo: f.ativoReceptivo,
      }),
  });

const concentracaoQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["concentracao-agentes", f],
    staleTime: STALE_TIME,
    enabled: !!f.dataInicio && !!f.dataFim,
    queryFn: () =>
      rpc<ConcentracaoAgente[]>("get_concentracao_agentes", {
        p_data_inicio: f.dataInicio,
        p_data_fim: f.dataFim,
        p_conta: f.conta ?? null,
        p_tipo: f.tipo ?? null,
      }),
  });


function ErrorPanel({ error }: { error: unknown }) {
  return (
    <div className="surface border border-red-500/40 p-5 text-sm text-red-200">
      Não foi possível carregar esta análise. {error instanceof Error ? error.message : "Erro na consulta."}
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  cor,
  tooltip,
  filters,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
  tooltip?: string;
  filters: DashboardFilters;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="surface p-5 relative">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <div className="flex items-center gap-2">
          <ExportButton
            compact
            filename={`gav-${titulo}-${exportDateSuffix()}`}
            sheetName={titulo}
            fetchData={() =>
              withDashboardFilters(filters, [
                { Indicador: titulo, Valor: valor, Detalhe: detalhe ?? "" },
              ])
            }
          />
          {tooltip && (
          <div className="relative flex-shrink-0">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Informação sobre ${titulo}`}
            >
              <Info className="size-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-6 z-50 w-64 rounded-lg border border-border bg-[#1C324B] p-3 text-xs text-[#F3EEDF] shadow-xl">
                <div className="absolute -top-1.5 right-1 size-3 rotate-45 border-l border-t border-border bg-[#1C324B]" />
                {tooltip}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      <p className={`mt-2 font-display text-3xl font-bold ${cor ?? "text-foreground"}`}>
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function OperacionalPage() {
  const { state, setState, filters } = useDashboardFilters();
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
  const pct = (v: number | null | undefined) =>
    `${(v ?? 0).toFixed(1).replace(".", ",")}%`;

  const status = useQuery(indicadoresStatusQuery(filters));
  const fcr = useQuery(fcrQuery(filters));
  const interacoes = useQuery(interacoesQuery(filters));
  const concentracao = useQuery(concentracaoQuery(filters));

  return (
    <>
      <PageHeader
        title="Operacional"
        description="Indicadores operacionais: status, FCR, interações e produtividade por agente."
      />
      <Filters state={state} onChange={setState} />

      {/* STATUS */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Status dos Atendimentos
        </h2>
        {status.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : status.isError ? (
          <ErrorPanel error={status.error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Finalizados"
              valor={n(status.data?.finalizados)}
              detalhe={`${pct(status.data?.pct_finalizados)} do total`}
              cor="text-emerald-400"
              filters={filters}
              tooltip="Atendimentos encerrados com sucesso após interação completa com o cliente. É o desfecho ideal de um atendimento."
            />
            <KpiCard
              titulo="Finaliz. por Inatividade"
              valor={n(status.data?.finalizados_inatividade)}
              detalhe={`${pct(status.data?.pct_inatividade)} do total`}
              cor="text-amber-400"
              filters={filters}
              tooltip="Atendimentos encerrados automaticamente porque o cliente parou de responder. Alta taxa pode indicar demora no retorno do agente ou cliente não encontrou o que precisava."
            />
            <KpiCard
              titulo="Transferidos"
              valor={n(status.data?.transferidos)}
              detalhe={`${pct(status.data?.pct_transferencia)} do total`}
              cor="text-blue-400"
              filters={filters}
              tooltip="Atendimentos transferidos de uma fila ou agente para outro. Taxa alta pode indicar problema na triagem inicial ou na especialização das filas."
            />
            <KpiCard
              titulo="Em Atendimento"
              valor={n(status.data?.em_atendimento)}
              detalhe="Atendimentos abertos"
              filters={filters}
              tooltip="Atendimentos que ainda estão em andamento no momento da análise. Número alto pode indicar acúmulo de demanda ou atendimentos muito longos."
            />
          </div>
        )}
      </div>

      {/* FCR */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Resolução no Primeiro Contato (FCR)
        </h2>
        {fcr.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : fcr.isError ? (
          <ErrorPanel error={fcr.error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              titulo="Clientes únicos"
              valor={n(fcr.data?.total_clientes)}
              detalhe="Telefones distintos no período"
              filters={filters}
              tooltip="Quantidade de clientes diferentes que entraram em contato no período, identificados pelo número de telefone. Um cliente pode ter múltiplos atendimentos."
            />
            <KpiCard
              titulo="Resolvidos no 1º contato"
              valor={n(fcr.data?.resolvidos_primeiro_contato)}
              detalhe={`${pct(fcr.data?.fcr_percentual)} dos clientes`}
              cor="text-emerald-400"
              filters={filters}
              tooltip="First Call Resolution (FCR): clientes que não voltaram a entrar em contato nas 24 horas seguintes ao atendimento. Indica que o problema foi resolvido logo na primeira tentativa. Quanto maior, melhor."
            />
            <KpiCard
              titulo="Retornaram em 24h"
              valor={n(fcr.data?.retornaram_24h)}
              detalhe="Possível não resolução"
              cor="text-rose-400"
              filters={filters}
              tooltip="Clientes que voltaram a entrar em contato em menos de 24 horas após o atendimento. Indica possível não resolução do problema no primeiro contato. Quanto menor, melhor."
            />
          </div>
        )}
      </div>

      {/* INTERAÇÕES */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Interações por Atendimento (QIC / QIA)
        </h2>
        {interacoes.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : interacoes.isError ? (
          <ErrorPanel error={interacoes.error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              titulo="QIC médio"
              valor={String(interacoes.data?.qic_medio ?? "—")}
              detalhe="Mensagens do cliente por atendimento"
              filters={filters}
              tooltip="Quantidade de Interações do Cliente (QIC): média de mensagens enviadas pelo cliente em cada atendimento. Valor alto indica clientes que precisaram de muita troca para ser atendidos."
            />
            <KpiCard
              titulo="QIA médio"
              valor={String(interacoes.data?.qia_medio ?? "—")}
              detalhe="Mensagens do agente por atendimento"
              filters={filters}
              tooltip="Quantidade de Interações do Agente (QIA): média de mensagens enviadas pelo agente em cada atendimento. Valor muito alto pode indicar atendimentos complexos ou falta de objetividade nas respostas."
            />
            <KpiCard
              titulo="Alta interação (≥5 msgs)"
              valor={n(interacoes.data?.alta_interacao)}
              detalhe="Atendimentos com 5+ mensagens do cliente"
              cor="text-amber-400"
              filters={filters}
              tooltip="Atendimentos onde o cliente enviou 5 ou mais mensagens. São os casos mais complexos ou onde o cliente teve dificuldade de ser atendido. Merecem atenção especial da gestão."
            />
          </div>
        )}
      </div>

      {/* CONCENTRAÇÃO POR AGENTE */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Concentração de Volume por Agente
          </h2>
          {(concentracao.data ?? []).length > 0 ? (
            <ExportButton
              compact
              filename={`gav-concentracao-agentes-${exportDateSuffix()}`}
              sheetName="Concentração por agente"
              fetchData={() =>
                withDashboardFilters(
                  filters,
                  (concentracao.data ?? []).map((row) => ({
                    Agente: row.agente,
                    Volume: Number(row.total),
                    "% Volume": Number(row.percentual_volume ?? 0),
                    "1ª Resposta": formatarDuracao(row.tpr_segundos),
                    TMA: formatarDuracao(row.tma_segundos),
                    "% Inatividade": Number(row.pct_inatividade ?? 0),
                  })),
                )
              }
            />
          ) : null}
        </div>
        {concentracao.isPending ? (
          <Skeleton className="h-64" />
        ) : concentracao.isError ? (
          <ErrorPanel error={concentracao.error} />
        ) : (concentracao.data ?? []).length === 0 ? (
          <div className="surface flex items-center justify-center p-8 text-sm text-muted-foreground">
            Sem dados no período selecionado.
          </div>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agente</th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span title="Total de atendimentos do agente no período">Volume</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span title="Percentual do volume total da equipe atribuído a este agente">% Volume</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span title="Tempo médio entre o cliente entrar na fila e receber a 1ª mensagem do agente">1ª Resposta</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span title="Tempo Médio de Atendimento: duração média de cada atendimento do agente">TMA</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span title="Percentual de atendimentos encerrados por inatividade do cliente. Alto pode indicar demora nas respostas do agente">% Inatividade</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(concentracao.data ?? []).map((row) => (
                  <tr key={row.agente} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.agente}</td>
                    <td className="px-4 py-2.5 text-right">{n(row.total)}</td>
                    <td className="px-4 py-2.5 text-right">{pct(row.percentual_volume)}</td>
                    <td className="px-4 py-2.5 text-right">{formatarDuracao(row.tpr_segundos)}</td>
                    <td className="px-4 py-2.5 text-right">{formatarDuracao(row.tma_segundos)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        (row.pct_inatividade ?? 0) > 50 ? "text-amber-400" : "text-foreground"
                      }`}
                    >
                      {pct(row.pct_inatividade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
