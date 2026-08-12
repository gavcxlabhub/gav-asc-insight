import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const STALE_TIME = 5 * 60 * 1000;

/** Total de atendimentos — usa count agregado, nunca traz linhas. */
export const totalAtendimentosQuery = () =>
  queryOptions({
    queryKey: ["atendimentos", "count"],
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("atendimentos")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
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
}

export const importacoesQuery = () =>
  queryOptions({
    queryKey: ["importacoes"],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ImportacaoResumo[]> => {
      const { data, error } = await supabase
        .from("importacoes")
        .select(
          "id, nome_arquivo, periodo_inicio, periodo_fim, total_lido, registros_novos, duplicados, invalidos, created_at",
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
      const [first, last] = await Promise.all([
        supabase
          .from("atendimentos")
          .select("data_entrada")
          .not("data_entrada", "is", null)
          .order("data_entrada", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("atendimentos")
          .select("data_entrada")
          .not("data_entrada", "is", null)
          .order("data_entrada", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (first.error) throw first.error;
      if (last.error) throw last.error;
      return {
        inicio: first.data?.data_entrada ?? null,
        fim: last.data?.data_entrada ?? null,
      };
    },
  });
