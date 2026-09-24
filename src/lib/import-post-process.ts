import { supabase } from "@/integrations/supabase/client";

export interface PostProcessProgress {
  etapa: "fila" | "recorrencia" | "clientes" | "resumo" | "concluido";
  processados: number;
  total: number;
  mensagem: string;
}

export interface ProcessamentoImportacaoStatus {
  importacao_id: string;
  total_telefones: number;
  recorrencia_concluidos: number;
  recorrencia_pendentes: number;
  clientes_concluidos: number;
  clientes_pendentes: number;
}

type ProgressCallback = (progress: PostProcessProgress) => void;

type RpcError = { message: string } | null;

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args) as {
    data: T;
    error: RpcError;
  };
  if (error) throw new Error(error.message);
  return data;
}

async function atualizarStatusImportacao(
  importacaoId: string,
  status: "processando" | "pendente" | "concluido",
  etapa: string | null,
  mensagem: string | null,
) {
  const { error } = await supabase
    .from("importacoes")
    .update({
      processamento_status: status,
      processamento_etapa: etapa,
      processamento_mensagem: mensagem,
      processamento_atualizado_em: new Date().toISOString(),
    } as any)
    .eq("id", importacaoId);

  if (error) throw new Error(error.message);
}

export async function obterStatusProcessamento(
  importacaoId: string,
): Promise<ProcessamentoImportacaoStatus | null> {
  const rows = await rpc<ProcessamentoImportacaoStatus[]>("get_processamento_importacoes");
  return rows.find((row) => row.importacao_id === importacaoId) ?? null;
}

export async function prepararFilaImportacao(
  importacaoId: string,
  telefones: string[],
  onProgress?: ProgressCallback,
) {
  const unicos = Array.from(new Set(telefones.filter(Boolean)));
  const BATCH = 1500;

  for (let i = 0; i < unicos.length; i += BATCH) {
    const lote = unicos.slice(i, i + BATCH);
    await rpc<number>("adicionar_telefones_recorrencia_queue", {
      p_importacao_id: importacaoId,
      p_telefones: lote,
    });
    onProgress?.({
      etapa: "fila",
      processados: Math.min(i + BATCH, unicos.length),
      total: unicos.length,
      mensagem: "Preparando fila de recorrência…",
    });
  }
}

function isoDateOnly(value: string) {
  return value.slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minDate(a: string, b: string) {
  return a <= b ? a : b;
}

export async function finalizarIndicadoresImportacao(options: {
  importacaoId: string;
  periodoInicio: string;
  periodoFim: string;
  onProgress?: ProgressCallback;
}) {
  const { importacaoId, periodoInicio, periodoFim, onProgress } = options;

  try {
    await atualizarStatusImportacao(
      importacaoId,
      "processando",
      "recorrencia",
      "Atualizando recorrência do sistema.",
    );

    let status = await obterStatusProcessamento(importacaoId);
    if (!status || status.total_telefones === 0) {
      throw new Error("Fila de processamento não encontrada para esta importação.");
    }

    const totalTelefones = Number(status.total_telefones);

    while (Number(status.recorrencia_pendentes) > 0) {
      const resultado = await rpc<{
        processados: number;
        restantes: number;
        atualizados: number;
      }>("processar_recorrencia_importacao_lote_fast", {
        p_importacao_id: importacaoId,
        p_limite: 500,
      });

      const restantes = Number(resultado.restantes ?? 0);
      onProgress?.({
        etapa: "recorrencia",
        processados: Math.max(0, totalTelefones - restantes),
        total: totalTelefones,
        mensagem: "Calculando Rechamadas, Reincidências e Recorrências…",
      });

      if (Number(resultado.processados ?? 0) === 0 && restantes > 0) {
        throw new Error("A fila de recorrência não avançou. Tente retomar o processamento.");
      }

      status = {
        ...status,
        recorrencia_pendentes: restantes,
        recorrencia_concluidos: totalTelefones - restantes,
      };
    }

    await atualizarStatusImportacao(
      importacaoId,
      "processando",
      "clientes",
      "Atualizando frequência de contatos e FCR.",
    );

    status = await obterStatusProcessamento(importacaoId);
    let clientesPendentes = Number(status?.clientes_pendentes ?? 0);

    while (clientesPendentes > 0) {
      const resultado = await rpc<{
        processados: number;
        restantes: number;
      }>("processar_clientes_importacao_lote", {
        p_importacao_id: importacaoId,
        p_limite: 500,
      });

      clientesPendentes = Number(resultado.restantes ?? 0);
      onProgress?.({
        etapa: "clientes",
        processados: Math.max(0, totalTelefones - clientesPendentes),
        total: totalTelefones,
        mensagem: "Atualizando clientes únicos e frequência de contato…",
      });

      if (Number(resultado.processados ?? 0) === 0 && clientesPendentes > 0) {
        throw new Error("A atualização de clientes não avançou. Tente retomar o processamento.");
      }
    }

    await atualizarStatusImportacao(
      importacaoId,
      "processando",
      "resumo",
      "Atualizando dashboards e resumos analíticos.",
    );

    const inicio = isoDateOnly(periodoInicio);
    const importFimMais90 = addDays(isoDateOnly(periodoFim), 90);
    const baseResumo = await rpc<{ fim: string | null }>("get_base_resumo");
    const fimBase = baseResumo?.fim ? isoDateOnly(baseResumo.fim) : importFimMais90;
    const fim = minDate(importFimMais90, fimBase);

    const intervalos: Array<{ inicio: string; fim: string }> = [];
    let cursor = inicio;
    while (cursor <= fim) {
      const chunkFim = minDate(addDays(cursor, 6), fim);
      intervalos.push({ inicio: cursor, fim: chunkFim });
      cursor = addDays(chunkFim, 1);
    }

    for (let i = 0; i < intervalos.length; i++) {
      const faixa = intervalos[i]!;
      await rpc<void>("refresh_atendimentos_resumo", {
        p_inicio: faixa.inicio,
        p_fim: faixa.fim,
      });
      onProgress?.({
        etapa: "resumo",
        processados: i + 1,
        total: intervalos.length,
        mensagem: "Atualizando os indicadores dos dashboards…",
      });
    }

    await atualizarStatusImportacao(
      importacaoId,
      "concluido",
      "concluido",
      "Indicadores atualizados com sucesso.",
    );

    onProgress?.({
      etapa: "concluido",
      processados: 1,
      total: 1,
      mensagem: "Indicadores atualizados com sucesso.",
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao atualizar indicadores.";
    try {
      await atualizarStatusImportacao(importacaoId, "pendente", "pendente", mensagem);
    } catch {
      // Mantém o erro original.
    }
    throw error;
  }
}
