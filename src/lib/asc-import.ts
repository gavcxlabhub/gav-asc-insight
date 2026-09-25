import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  finalizarIndicadoresImportacao,
  prepararFilaImportacao,
} from "@/lib/import-post-process";

export type ImportStage =
  | "idle"
  | "lendo"
  | "validando"
  | "duplicatas"
  | "salvando"
  | "concluido"
  | "erro";

export interface ImportProgress {
  stage: ImportStage;
  processed: number;
  total: number;
  message?: string;
}

export interface ImportSummary {
  totalLido: number;
  novos: number;
  duplicados: number;
  invalidos: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  importacaoId: string | null;
  processamentoPendente?: boolean;
  aviso?: string;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  agente: ["agente", "atendente", "operador"],
  conta: ["conta", "departamento", "setor"],
  servico: ["servico", "servicos"],
  contato: ["contato", "nomecontato", "cliente"],
  telefone: ["telefone", "fone", "celular"],
  numero_externo: ["numeroexterno", "numexterno", "numeroext"],
  protocolo: ["protocolo", "numeroprotocolo"],
  canal: ["canal"],
  data_entrada: ["dataentrada", "datadeentrada", "entrada"],
  data_atendimento: ["dataatendimento", "datadeatendimento"],
  primeira_mensagem_agente: [
    "primeiramensagemagente",
    "primeiramensagem",
    "dataprimeiramensagemagente",
  ],
  data_fila: ["datafila", "datadefila"],
  tempo_em_fila: ["tempoemfila", "tempofila"],
  tempo_atendimento: ["tempoatendimento", "tempodeatendimento"],
  tempo_atendimento_automatico: [
    "tempoatendimentoautomatico",
    "tempodeatendimentoautomatico",
  ],
  tempo_pendencia: ["tempopendencia", "tempodependencia"],
  tmic: ["tmic"],
  tmia: ["tmia"],
  status: ["status", "situacao"],
  tipo: ["tipo", "tipoatendimento"],
  classificacao_origem: ["classificacao", "classificacaoorigem"],
  recorrencia_origem: ["recorrencia", "recorrenciaorigem"],
  data_finalizacao: ["datafinalizacao", "datadefinalizacao", "finalizacao"],
  ativo_receptivo: ["ativoreceptivo", "ativoreceptivo2", "ativoureceptivo"],
  qic: ["qic"],
  qia: ["qia"],
  protocolo_dependente: ["protocolodependente"],
  atendimento_original: ["atendimentooriginal"],
  tag: ["tag", "tags"],
  prioritario: ["prioritario", "prioridade"],
  ferramenta: ["ferramenta"],
};

const DATE_FIELDS = new Set([
  "data_entrada",
  "data_atendimento",
  "data_fila",
  "data_finalizacao",
  "primeira_mensagem_agente",
]);

function buildColumnMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((raw, index) => {
    const normalized = normalizeHeader(String(raw ?? ""));
    if (!normalized) return;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalized)) {
        map[index] = field;
        return;
      }
    }
  });
  return map;
}

export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;

  const br = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (br) {
    const [, d, m, y, hh, mm, ss] = br;
    const year = y!.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(
      Date.UTC(year, Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0)),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (/^\d+(\.\d+)?$/.test(text)) return toIsoDate(Number(text));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizePhone(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "");
}

export function normalizeAtivoReceptivo(value: unknown): string | null {
  if (!value) return null;
  const v = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v === "ativo" || v === "ativa") return "Ativo";
  if (v === "receptivo" || v === "receptiva") return "Receptivo";
  return null;
}

export interface AtendimentoRow {
  [key: string]: string | null | Record<string, unknown>;
}

function buildRow(
  raw: Record<string, unknown>,
  arquivo: string,
): AtendimentoRow | null {
  const text = (field: string): string | null => {
    const v = raw[field];
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    return s === "" ? null : s;
  };

  const telefone = raw["telefone"] === undefined ? null : String(raw["telefone"]).trim();
  const telefoneNormalizado = normalizePhone(telefone);
  const dataEntrada = toIsoDate(raw["data_entrada"]);
  const protocolo = text("protocolo");
  const conta = text("conta");
  const agente = text("agente");
  const ativoReceptivo = normalizeAtivoReceptivo(raw["ativo_receptivo"]);

  if (!protocolo && !telefone && !dataEntrada) return null;

  // Chave técnica estável para o relatório analítico atual da ASC.
  // O mesmo protocolo pode aparecer mais de uma vez para o mesmo agente
  // (transferência, mudança de serviço/status etc.), então protocolo+agente
  // não é suficiente para identificar uma linha única.
  const key = [
    (protocolo ?? "").trim().toLowerCase(),
    telefoneNormalizado,
    dataEntrada ?? "",
    (conta ?? "").trim().toLowerCase(),
    (agente ?? "").trim().toLowerCase(),
    (ativoReceptivo ?? "").trim().toLowerCase(),
  ].join("|");

  return {
    protocolo,
    source_record_key: key,
    agente,
    conta,
    servico: text("servico"),
    contato: text("contato"),
    telefone: telefone && telefone !== "" ? telefone : null,
    telefone_normalizado: telefoneNormalizado || null,
    numero_externo: text("numero_externo"),
    canal: text("canal") ?? "Whatsapp",
    data_entrada: dataEntrada,
    data_atendimento: toIsoDate(raw["data_atendimento"]),
    data_fila: toIsoDate(raw["data_fila"]),
    data_finalizacao: toIsoDate(raw["data_finalizacao"]),
    primeira_mensagem_agente: toIsoDate(raw["primeira_mensagem_agente"]),
    tempo_em_fila: text("tempo_em_fila"),
    tempo_atendimento: text("tempo_atendimento"),
    tempo_atendimento_automatico: text("tempo_atendimento_automatico"),
    tempo_pendencia: text("tempo_pendencia"),
    tmic: text("tmic"),
    tmia: text("tmia"),
    status: text("status"),
    tipo: text("tipo"),
    ativo_receptivo: ativoReceptivo,
    classificacao_origem: text("classificacao_origem"),
    recorrencia_origem: text("recorrencia_origem"),
    tag: text("tag"),
    prioritario: text("prioritario"),
    qic: text("qic"),
    qia: text("qia"),
    protocolo_dependente: text("protocolo_dependente"),
    atendimento_original: text("atendimento_original"),
    ferramenta: text("ferramenta") ?? "ASC",
    arquivo_origem: arquivo,
    dados_origem: null,
  };
}

const BATCH_SIZE = 500;

function isStatementTimeoutError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /statement timeout|canceling statement due to statement timeout/i.test(message);
}

async function upsertAtendimentosAdaptativo(
  rows: Array<AtendimentoRow & { importacao_id: string }>,
): Promise<Array<{ source_record_key: string | null; telefone_normalizado: string | null; data_entrada: string | null }>> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("atendimentos")
    .upsert(rows as any, { onConflict: "source_record_key", ignoreDuplicates: true })
    .select("source_record_key, telefone_normalizado, data_entrada");

  if (!error) {
    return (data ?? []) as Array<{
      source_record_key: string | null;
      telefone_normalizado: string | null;
      data_entrada: string | null;
    }>;
  }

  if (isStatementTimeoutError(error) && rows.length > 25) {
    const meio = Math.ceil(rows.length / 2);
    const esquerda = await upsertAtendimentosAdaptativo(rows.slice(0, meio));
    const direita = await upsertAtendimentosAdaptativo(rows.slice(meio));
    return [...esquerda, ...direita];
  }

  throw new Error(`[${(error as any).code ?? "erro"}] ${error.message}`);
}

async function contarRegistrosImportacao(importacaoId: string): Promise<number> {
  const { count, error } = await supabase
    .from("atendimentos")
    .select("id", { count: "exact", head: true })
    .eq("importacao_id", importacaoId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function importAscFile(
  file: File,
  userId: string,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportSummary> {
  onProgress({ stage: "lendo", processed: 0, total: 0 });

  const rawBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(rawBuffer);
  const cleaned = uint8.filter(b => b !== 0x00);
  const buffer = cleaned.buffer;
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo sem planilhas.");
  const sheet = workbook.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });

  const headerRow = matrix.findIndex(
    (row) => Array.isArray(row) && row.some((c) => c !== null && String(c).trim() !== ""),
  );
  if (headerRow === -1) throw new Error("Arquivo vazio.");

  const headers = (matrix[headerRow] as unknown[]).map((c) => String(c ?? ""));
  const columnMap = buildColumnMap(headers);
  if (Object.keys(columnMap).length === 0) {
    throw new Error("Não foi possível reconhecer as colunas da ASC neste arquivo.");
  }

  const dataRows = matrix.slice(headerRow + 1).filter(
    (row) => Array.isArray(row) && row.some((c) => c !== null && String(c).trim() !== ""),
  );

  onProgress({ stage: "validando", processed: 0, total: dataRows.length });

  const parsed: AtendimentoRow[] = [];
  let invalidos = 0;
  const seen = new Set<string>();
  let duplicadosArquivo = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[];
    const raw: Record<string, unknown> = {};
    for (const [indexStr, field] of Object.entries(columnMap)) {
      const value = row[Number(indexStr)];
      raw[field] = DATE_FIELDS.has(field) ? value : value;
    }
    const built = buildRow(raw, file.name);
    if (!built) {
      invalidos += 1;
    } else {
      const key = built["source_record_key"] as string;
      if (seen.has(key)) {
        duplicadosArquivo += 1;
      } else {
        seen.add(key);
        parsed.push(built);
      }
    }
    if (i % 100 === 0) {
      onProgress({ stage: "validando", processed: i, total: dataRows.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress({ stage: "duplicatas", processed: parsed.length, total: parsed.length });
  const novosRows = parsed;
  let inseridosNestaExecucao = 0;
  let duplicados = duplicadosArquivo;


  const datas = parsed
    .map((r) => r["data_entrada"] as string | null)
    .filter((d): d is string => !!d)
    .sort();
  const periodoInicio = datas[0] ?? null;
  const periodoFim = datas[datas.length - 1] ?? null;

  const { data: importacaoPendente, error: pendenteError } = await supabase
    .from("importacoes")
    .select("id, registros_novos")
    .eq("nome_arquivo", file.name)
    .eq("total_lido", dataRows.length)
    .eq("processamento_status", "pendente")
    .eq("processamento_etapa", "importacao")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendenteError) throw pendenteError;

  let importacaoId: string;
  const retomandoImportacao = !!importacaoPendente?.id;

  if (retomandoImportacao) {
    importacaoId = importacaoPendente!.id as string;
    await supabase
      .from("importacoes")
      .update({
        processamento_status: "processando",
        processamento_etapa: "importacao",
        processamento_mensagem: "Retomando importação interrompida.",
        processamento_atualizado_em: new Date().toISOString(),
      } as any)
      .eq("id", importacaoId);
  } else {
    const { data: importacao, error: impError } = await supabase
      .from("importacoes")
      .insert({
        nome_arquivo: file.name,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        total_lido: dataRows.length,
        registros_novos: 0,
        duplicados: duplicadosArquivo,
        invalidos,
        usuario_id: userId,
        processamento_status: "processando",
        processamento_etapa: "importacao",
        processamento_mensagem: "Importando registros da ASC.",
        processamento_atualizado_em: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (impError) throw impError;
    importacaoId = importacao.id as string;
  }

  onProgress({
    stage: "salvando",
    processed: 0,
    total: novosRows.length,
    message: retomandoImportacao
      ? "Retomando a mesma base sem duplicar os registros já salvos…"
      : "Salvando registros no banco…",
  });

  try {
    for (let i = 0; i < novosRows.length; i += BATCH_SIZE) {
      const batch = novosRows.slice(i, i + BATCH_SIZE).map((r) => ({
        ...r,
        importacao_id: importacaoId,
      }));

      const inseridosBatch = await upsertAtendimentosAdaptativo(batch as Array<
        AtendimentoRow & { importacao_id: string }
      >);

      inseridosNestaExecucao += inseridosBatch.length;

      onProgress({
        stage: "salvando",
        processed: Math.min(i + BATCH_SIZE, novosRows.length),
        total: novosRows.length,
        message: retomandoImportacao
          ? `Retomando a importação · ${inseridosNestaExecucao.toLocaleString("pt-BR")} novos nesta tentativa…`
          : `Salvando registros · ${inseridosNestaExecucao.toLocaleString("pt-BR")} inseridos…`,
      });

      if (i % 5000 === 0 || i + BATCH_SIZE >= novosRows.length) {
        const totalImportadosAteAgora = await contarRegistrosImportacao(importacaoId);
        await supabase
          .from("importacoes")
          .update({
            registros_novos: totalImportadosAteAgora,
            processamento_status: "processando",
            processamento_etapa: "importacao",
            processamento_mensagem: `Importando registros: ${totalImportadosAteAgora.toLocaleString("pt-BR")} salvos.`,
            processamento_atualizado_em: new Date().toISOString(),
          } as any)
          .eq("id", importacaoId);
      }

      await new Promise((r) => setTimeout(r, 50));
    }
  } catch (error) {
    const totalImportadosAteAgora = await contarRegistrosImportacao(importacaoId).catch(() => 0);
    const mensagem =
      error instanceof Error
        ? `Importação interrompida após ${totalImportadosAteAgora.toLocaleString("pt-BR")} registros. Reenvie o mesmo arquivo para retomar. ${error.message}`
        : `Importação interrompida após ${totalImportadosAteAgora.toLocaleString("pt-BR")} registros. Reenvie o mesmo arquivo para retomar.`;

    await supabase
      .from("importacoes")
      .update({
        registros_novos: totalImportadosAteAgora,
        processamento_status: "pendente",
        processamento_etapa: "importacao",
        processamento_mensagem: mensagem,
        processamento_atualizado_em: new Date().toISOString(),
      } as any)
      .eq("id", importacaoId);

    throw new Error(mensagem);
  }

  const totalVinculadoImportacao = await contarRegistrosImportacao(importacaoId);
  const duplicadosBanco = Math.max(0, novosRows.length - totalVinculadoImportacao);
  duplicados = duplicadosArquivo + duplicadosBanco;

  await supabase
    .from("importacoes")
    .update({
      registros_novos: totalVinculadoImportacao,
      duplicados,
      invalidos,
      processamento_status: "processando",
      processamento_etapa: "fila",
      processamento_mensagem: "Base concluída. Preparando indicadores.",
      processamento_atualizado_em: new Date().toISOString(),
    } as any)
    .eq("id", importacaoId);

  let processamentoPendente = false;
  let aviso: string | undefined;

  const telefonesArquivo = Array.from(
    new Set(
      parsed
        .map((row) => row["telefone_normalizado"] as string | null)
        .filter((telefone): telefone is string => !!telefone),
    ),
  );

  if (totalVinculadoImportacao > 0 && periodoInicio && periodoFim) {
    try {
      const telefones = telefonesArquivo;

      await supabase
        .from("importacoes")
        .update({
          processamento_status: "processando",
          processamento_etapa: "fila",
          processamento_mensagem: "Preparando indicadores da nova base.",
          processamento_atualizado_em: new Date().toISOString(),
        } as any)
        .eq("id", importacaoId);

      await prepararFilaImportacao(importacaoId, telefones, (p) => {
        onProgress({
          stage: "salvando",
          processed: p.processados,
          total: p.total,
          message: p.mensagem,
        });
      });

      await finalizarIndicadoresImportacao({
        importacaoId,
        periodoInicio,
        periodoFim,
        onProgress: (p) => {
          onProgress({
            stage: "salvando",
            processed: p.processados,
            total: p.total,
            message: p.mensagem,
          });
        },
      });
    } catch (error) {
      processamentoPendente = true;
      aviso =
        error instanceof Error
          ? `A base foi importada, mas os indicadores ficaram pendentes: ${error.message}`
          : "A base foi importada, mas os indicadores ficaram pendentes.";

      await supabase
        .from("importacoes")
        .update({
          processamento_status: "pendente",
          processamento_etapa: "pendente",
          processamento_mensagem: aviso,
          processamento_atualizado_em: new Date().toISOString(),
        } as any)
        .eq("id", importacaoId);
    }
  } else {
    await supabase
      .from("importacoes")
      .update({
        processamento_status: "concluido",
        processamento_etapa: "concluido",
        processamento_mensagem: "Nenhum registro novo para processar.",
        processamento_atualizado_em: new Date().toISOString(),
      } as any)
      .eq("id", importacaoId);
  }

  onProgress({ stage: "concluido", processed: novosRows.length, total: novosRows.length });

  return {
    totalLido: dataRows.length,
    novos: totalVinculadoImportacao,
    duplicados,
    invalidos,
    periodoInicio,
    periodoFim,
    importacaoId,
    processamentoPendente,
    aviso,
  };
}
