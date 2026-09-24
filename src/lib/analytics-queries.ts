import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const STALE_TIME = 5 * 60 * 1000;

interface BaseResumo {
  total: number;
  inicio: string | null;
  fim: string | null;
}

async function fetchBaseResumo(): Promise<BaseResumo> {
  const { data, error } = await supabase.rpc("get_base_resumo");
  if (error) throw error;
  const r = (data ?? {}) as Partial<BaseResumo>;
  return { total: r.total ?? 0, inicio: r.inicio ?? null, fim: r.fim ?? null };
}

/** Total de atendimentos — usa RPC agregada, nunca traz linhas. */
export const totalAtendimentosQuery = () =>
  queryOptions({
    queryKey: ["atendimentos", "count"],
    staleTime: STALE_TIME,
    queryFn: async () => (await fetchBaseResumo()).total,
  });

export interface ImportacaoResumo {
  id: string;
  nome_arquivo: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_lido: number | null;
  registros_novos: number | null;
  duplicados: number | null;
  invalidos: number | null;
  created_at: string | null;
  processamento_status: string | null;
  processamento_etapa: string | null;
  processamento_mensagem: string | null;
  processamento_atualizado_em: string | null;
}

export const importacoesQuery = () =>
  queryOptions({
    queryKey: ["importacoes"],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ImportacaoResumo[]> => {
      const { data, error } = await supabase
        .from("importacoes")
        .select(
          "id, nome_arquivo, periodo_inicio, periodo_fim, total_lido, registros_novos, duplicados, invalidos, created_at, processamento_status, processamento_etapa, processamento_mensagem, processamento_atualizado_em",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ImportacaoResumo[];
    },
  });

export const periodoBaseQuery = () =>
  queryOptions({
    queryKey: ["atendimentos", "periodo"],
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { inicio, fim } = await fetchBaseResumo();
      return { inicio, fim };
    },
  });
