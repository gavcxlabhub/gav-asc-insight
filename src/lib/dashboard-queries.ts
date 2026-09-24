import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const STALE_TIME = 1000 * 60 * 5;

type RpcArgs = Record<string, unknown>;

interface RpcClient {
  rpc: (name: string, args: RpcArgs) => Promise<{ data: unknown; error: { message: string } | null }>;
}

async function rpc<T>(name: string, args: RpcArgs): Promise<T> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type Granularidade = "dia" | "mes";

export interface DashboardFilters {
  dataInicio: string;
  dataFim: string;
  conta: string | null;
  servico: string | null;
  agente: string | null;
  tipo: string | null;
  ativoReceptivo: string | null;
  status: string | null;
  recorrencia: string | null;
}

export function filtrosRpcArgs(f: DashboardFilters): RpcArgs {
  return {
    p_data_inicio: f.dataInicio,
    p_data_fim: f.dataFim,
    p_conta: f.conta,
    p_servico: f.servico,
    p_agente: f.agente,
    p_tipo: f.tipo,
    p_ativo_receptivo: f.ativoReceptivo,
    p_status: f.status,
    p_recorrencia: f.recorrencia,
  };
}

export interface Kpis {
  total: number;
  humanos: number;
  mistos: number;
  automaticos: number;
  notificacoes: number;
  automacao: number;
  com_humano: number;
  ativos: number;
  receptivos: number;
  rechamadas: number;
  recorrentes: number;
  reincidentes: number;
  tme_segundos: number | null;
  tma_segundos: number | null;
  tpr_segundos: number | null;
  asc_rechamadas: number;
  asc_recorrentes: number;
  asc_reincidentes: number;
  sys_rechamadas: number;
  sys_recorrentes: number;
  sys_reincidentes: number;
}

export const kpisQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["kpis", f],
    staleTime: STALE_TIME,
    queryFn: () => {
      const args = filtrosRpcArgs(f);
      delete args["p_recorrencia"];
      return rpc<Kpis>("get_kpis", args);
    },
  });

export interface EvolucaoPonto {
  periodo: string;
  total: number;
  humanos: number;
  automaticos: number;
}

export const evolucaoQuery = (f: DashboardFilters, granularidade: Granularidade) =>
  queryOptions({
    queryKey: ["evolucao", f, granularidade],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<EvolucaoPonto[]>("get_evolucao_volume", {
        ...filtrosRpcArgs(f),
        p_granularidade: granularidade,
      }),
  });

export type Dimensao =
  | "conta"
  | "servico"
  | "agente"
  | "tipo"
  | "ativo_receptivo"
  | "status"
  | "hora"
  | "dia_semana"
  | "recorrencia";

export interface GrupoPonto {
  rotulo: string;
  total: number;
  humanos: number;
  receptivos: number;
}

export const agrupadoQuery = (f: DashboardFilters, dimensao: Dimensao, limite = 15) =>
  queryOptions({
    queryKey: ["agrupado", dimensao, limite, f],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<GrupoPonto[]>("get_agrupado", {
        ...filtrosRpcArgs(f),
        p_dimensao: dimensao,
        p_limite: limite,
      }),
  });

// Donut de tipo usando a RPC estável get_agrupado e agrupando apenas 4 categorias locais.
export const agrupadoTipoQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["agrupado-tipo", f],
    staleTime: STALE_TIME,
    queryFn: async () => {
      const rows = await rpc<GrupoPonto[]>("get_agrupado", {
        ...filtrosRpcArgs(f),
        p_dimensao: "tipo",
        p_limite: 20,
      });

      let comHumano = 0;
      let automacao = 0;
      let outros = 0;

      for (const row of rows ?? []) {
        if (row.rotulo === "Humano" || row.rotulo === "Misto") comHumano += Number(row.total ?? 0);
        else if (row.rotulo === "Automático" || row.rotulo === "Notificação") automacao += Number(row.total ?? 0);
        else outros += Number(row.total ?? 0);
      }

      const result: GrupoPonto[] = [
        { rotulo: "Com Humano", total: comHumano, humanos: comHumano, receptivos: 0 },
        { rotulo: "Automação", total: automacao, humanos: 0, receptivos: 0 },
      ];
      if (outros > 0) {
        result.push({ rotulo: "Outros", total: outros, humanos: 0, receptivos: 0 });
      }
      return result.filter((r) => r.total > 0);
    },
  });

export interface RecorrenciaPonto {
  periodo: string;
  rechamadas: number;
  recorrentes: number;
  reincidentes: number;
}

export const recorrenciaPeriodoQuery = (f: DashboardFilters, granularidade: Granularidade) =>
  queryOptions({
    queryKey: ["recorrencia-periodo", f, granularidade],
    staleTime: STALE_TIME,
    queryFn: () => {
      const args = filtrosRpcArgs(f);
      delete args["p_recorrencia"];
      return rpc<RecorrenciaPonto[]>("get_recorrencia_periodo", {
        ...args,
        p_granularidade: granularidade,
      });
    },
  });

export const filtroValoresQuery = (campo: "conta" | "servico" | "agente" | "status") =>
  queryOptions({
    queryKey: ["filtro-valores", campo],
    staleTime: STALE_TIME,
    queryFn: async () => {
      const linhas = await rpc<{ valor: string }[]>("get_filtro_valores", { p_campo: campo });
      return (linhas ?? []).map((l) => l.valor);
    },
  });

export interface AtendimentoLinha {
  id: string;
  protocolo: string | null;
  contato: string | null;
  telefone: string | null;
  agente: string | null;
  conta: string | null;
  servico: string | null;
  tipo: string | null;
  ativo_receptivo: string | null;
  status: string | null;
  data_entrada: string | null;
  tempo_em_fila: string | null;
  tempo_atendimento: string | null;
  recorrencia_origem: string | null;
  total_count: number;
}

export const atendimentosQuery = (
  f: DashboardFilters,
  busca: string,
  pagina: number,
  porPagina = 50,
) =>
  queryOptions({
    queryKey: ["atendimentos-lista", f, busca, pagina, porPagina],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<AtendimentoLinha[]>("get_atendimentos_paginado", {
        ...filtrosRpcArgs(f),
        p_busca: busca.trim() ? busca.trim() : null,
        p_pagina: pagina,
        p_por_pagina: porPagina,
      }),
  });

export async function buscarAtendimentosExport(f: DashboardFilters, busca: string) {
  return rpc<AtendimentoLinha[]>("get_atendimentos_paginado", {
    ...filtrosRpcArgs(f),
    p_busca: busca.trim() ? busca.trim() : null,
    p_pagina: 1,
    p_por_pagina: 5000,
  });
}

export function formatarDuracao(segundos: number | null | undefined) {
  if (segundos == null || Number.isNaN(segundos)) return "—";
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m` : m > 0 ? `${m}m ${pad(seg)}s` : `${seg}s`;
}

export function percentual(parte: number, total: number) {
  if (!total) return "0,0%";
  return `${((parte / total) * 100).toFixed(1).replace(".", ",")}%`;
}

export type DimensaoDetalhe = "conta" | "servico" | "agente";
export type TipoRecorrencia = "rechamada" | "recorrente" | "reincid";

export interface RecorrenciaDimensaoLinha {
  rotulo: string;
  total: number;
  com_recorrencia: number;
  percentual: number | null;
}

function filtrosSemRecorrencia(f: DashboardFilters): RpcArgs {
  const args = filtrosRpcArgs(f);
  delete args["p_recorrencia"];
  return args;
}

export const recorrenciaDimensaoQuery = (
  f: DashboardFilters,
  dimensao: DimensaoDetalhe,
  tipoRecorrencia: TipoRecorrencia,
  limite = 10,
) =>
  queryOptions({
    queryKey: ["recorrencia-dimensao", dimensao, tipoRecorrencia, limite, f],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<RecorrenciaDimensaoLinha[]>("get_recorrencia_por_dimensao", {
        ...filtrosSemRecorrencia(f),
        p_dimensao: dimensao,
        p_tipo_recorrencia: tipoRecorrencia,
        p_limite: limite,
      }),
  });

export interface DetalheDimensaoLinha {
  rotulo: string;
  total: number;
  humanos: number;
  mistos: number;
  automaticos: number;
  ativos: number;
  receptivos: number;
  rechamadas: number;
  recorrentes: number;
  reincidentes: number;
  tme_segundos: number | null;
  tma_segundos: number | null;
}

export const detalhesDimensaoQuery = (
  f: DashboardFilters,
  dimensao: DimensaoDetalhe,
  limite = 50,
) =>
  queryOptions({
    queryKey: ["detalhes-dimensao", dimensao, limite, f],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<DetalheDimensaoLinha[]>("get_detalhes_por_dimensao", {
        ...filtrosSemRecorrencia(f),
        p_dimensao: dimensao,
        p_limite: limite,
      }),
  });

export interface HeatmapCelula {
  dia_semana: string;
  hora: string;
  total: number;
}

export const heatmapQuery = (f: DashboardFilters) =>
  queryOptions({
    queryKey: ["heatmap", f],
    staleTime: STALE_TIME,
    queryFn: () =>
      rpc<HeatmapCelula[]>("get_heatmap", {
        p_data_inicio: f.dataInicio,
        p_data_fim: f.dataFim,
        p_conta: f.conta,
        p_tipo: f.tipo,
        p_ativo_receptivo: f.ativoReceptivo,
      }),
  });
