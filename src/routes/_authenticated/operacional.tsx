import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { Skeleton } from "@/components/ui/skeleton";
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

type RpcArgs = Record<string, unknown>;
interface RpcClient {
  rpc: (
    name: string,
    args: RpcArgs,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}
async function rpc<T>(name: string, args: RpcArgs): Promise<T> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(name, args);
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
    queryFn: () =>
      rpc<ConcentracaoAgente[]>("get_concentracao_agentes", {
        p_data_inicio: f.dataInicio,
        p_data_fim: f.dataFim,
        p_conta: f.conta,
        p_tipo: f.tipo,
      }),
  });

function KpiCard({
  titulo,
  valor,
  detalhe,
  cor,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
}) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
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
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              titulo="Finalizados"
              valor={n(status.data?.finalizados)}
              detalhe={`${pct(status.data?.pct_finalizados)} do total`}
              cor="text-emerald-400"
            />
            <KpiCard
              titulo="Finaliz. por Inatividade"
              valor={n(status.data?.finalizados_inatividade)}
              detalhe={`${pct(status.data?.pct_inatividade)} do total`}
              cor="text-amber-400"
            />
            <KpiCard
              titulo="Transferidos"
              valor={n(status.data?.transferidos)}
              detalhe={`${pct(status.data?.pct_transferencia)} do total`}
              cor="text-blue-400"
            />
            <KpiCard
              titulo="Em Atendimento"
              valor={n(status.data?.em_atendimento)}
              detalhe="Atendimentos abertos"
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
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              titulo="Clientes únicos"
              valor={n(fcr.data?.total_clientes)}
              detalhe="Telefones distintos no período"
            />
            <KpiCard
              titulo="Resolvidos no 1º contato"
              valor={n(fcr.data?.resolvidos_primeiro_contato)}
              detalhe={`${pct(fcr.data?.fcr_percentual)} dos clientes`}
              cor="text-emerald-400"
            />
            <KpiCard
              titulo="Retornaram em 24h"
              valor={n(fcr.data?.retornaram_24h)}
              detalhe="Possível não resolução"
              cor="text-rose-400"
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
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              titulo="QIC médio"
              valor={String(interacoes.data?.qic_medio ?? "—")}
              detalhe="Mensagens do cliente por atendimento"
            />
            <KpiCard
              titulo="QIA médio"
              valor={String(interacoes.data?.qia_medio ?? "—")}
              detalhe="Mensagens do agente por atendimento"
            />
            <KpiCard
              titulo="Alta interação (≥5 msgs)"
              valor={n(interacoes.data?.alta_interacao)}
              detalhe="Atendimentos com 5+ mensagens do cliente"
              cor="text-amber-400"
            />
          </div>
        )}
      </div>

      {/* CONCENTRAÇÃO POR AGENTE */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Concentração de Volume por Agente
        </h2>
        {concentracao.isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agente</th>
                  <th className="px-4 py-3 font-medium text-right">Volume</th>
                  <th className="px-4 py-3 font-medium text-right">% Volume</th>
                  <th className="px-4 py-3 font-medium text-right">1ª Resposta</th>
                  <th className="px-4 py-3 font-medium text-right">TMA</th>
                  <th className="px-4 py-3 font-medium text-right">% Inatividade</th>
                </tr>
              </thead>
              <tbody>
                {(concentracao.data ?? []).map((row) => (
                  <tr key={row.agente} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.agente}</td>
                    <td className="px-4 py-2.5 text-right">{n(row.total)}</td>
                    <td className="px-4 py-2.5 text-right">{pct(row.percentual_volume)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatarDuracao(row.tpr_segundos)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {formatarDuracao(row.tma_segundos)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        (row.pct_inatividade ?? 0) > 50
                          ? "text-amber-400"
                          : "text-foreground"
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
