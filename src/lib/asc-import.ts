import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

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
}

/** Normaliza um cabeçalho: minúsculo, sem acento, apenas letras e números. */
function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Sinônimos aceitos por campo (já normalizados). */
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

/** Converte serial Excel ou string em ISO. Retorna null se inválido. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial Excel (base 1899-12-30), em UTC.
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;

  // dd/mm/yyyy [hh:mm[:ss]]
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

  // Número em texto (serial Excel exportado como string)
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
  const n = normalizeHeader(String(value));
  if (!n) return null;
  if (n.startsWith("a")) return "Ativo";
  if (n.startsWith("r")) return "Receptivo";
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AtendimentoRow {
  [key: string]: string | null | Record<string, unknown>;
}

async function buildRow(
  raw: Record<string, unknown>,
  arquivo: string,
): Promise<AtendimentoRow | null> {
  const text = (field: string): string | null => {
    const v = raw[field];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  const telefone = raw["telefone"] === undefined ? null : String(raw["telefone"]).trim();
  const dataEntrada = toIsoDate(raw["data_entrada"]);
  const protocolo = text("protocolo");
  const conta = text("conta");
  const agente = text("agente");

  // Registro inválido: sem qualquer identificação útil.
  if (!protocolo && !telefone && !dataEntrada) return null;

  const key = await sha256Hex(
    [protocolo ?? "", normalizePhone(telefone), dataEntrada ?? "", conta ?? "", agente ?? ""].join(
      "|",
    ),
  );

  return {
    protocolo,
    source_record_key: key,
    agente,
    conta,
    servico: text("servico"),
    contato: text("contato"),
    telefone: telefone && telefone !== "" ? telefone : null,
    numero_externo: text("numero_externo"),
    canal: text("canal") ?? "Whatsapp",
    data_entrada: dataEntrada,
    data_atendimento: toIsoDate(raw["data_atendimento"]),
    data_fila: toIsoDate(raw["data_fila"]),
    data_finalizacao: toIsoDate(raw["data_finalizacao"]),
    primeira_mensagem_agente: toIsoDate(raw["primeira_mensagem_agente"]),
    tempo_em_fila: text("tempo_em_fila"),
    tempo_atendimento: text("tempo_atendimento"),
    tempo_pendencia: text("tempo_pendencia"),
    tmic: text("tmic"),
    tmia: text("tmia"),
    status: text("status"),
    tipo: text("tipo"),
    ativo_receptivo: normalizeAtivoReceptivo(raw["ativo_receptivo"]),
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
    dados_origem: raw as Record<string, unknown>,
  };
}

const BATCH_SIZE = 500;

export async function importAscFile(
  file: File,
  userId: string,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportSummary> {
  onProgress({ stage: "lendo", processed: 0, total: 0 });

  const buffer = await file.arrayBuffer();
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
    const built = await buildRow(raw, file.name);
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
    if (i % 200 === 0) {
      onProgress({ stage: "validando", processed: i, total: dataRows.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Identificando duplicatas já existentes no banco
  onProgress({ stage: "duplicatas", processed: 0, total: parsed.length });
  const existentes = new Set<string>();
  const keys = parsed.map((r) => r["source_record_key"] as string);
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const chunk = keys.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("atendimentos")
      .select("source_record_key")
      .in("source_record_key", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.source_record_key) existentes.add(row.source_record_key);
    }
    onProgress({ stage: "duplicatas", processed: Math.min(i + BATCH_SIZE, keys.length), total: keys.length });
  }

  const novosRows = parsed.filter((r) => !existentes.has(r["source_record_key"] as string));
  const duplicados = duplicadosArquivo + (parsed.length - novosRows.length);

  // Período coberto
  const datas = parsed
    .map((r) => r["data_entrada"] as string | null)
    .filter((d): d is string => !!d)
    .sort();
  const periodoInicio = datas[0] ?? null;
  const periodoFim = datas[datas.length - 1] ?? null;

  // Registro da importação
  const { data: importacao, error: impError } = await supabase
    .from("importacoes")
    .insert({
      nome_arquivo: file.name,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      total_lido: dataRows.length,
      registros_novos: novosRows.length,
      duplicados,
      invalidos,
      usuario_id: userId,
    })
    .select("id")
    .single();
  if (impError) throw impError;

  const importacaoId = importacao.id as string;

  onProgress({ stage: "salvando", processed: 0, total: novosRows.length });

  for (let i = 0; i < novosRows.length; i += BATCH_SIZE) {
    const batch = novosRows.slice(i, i + BATCH_SIZE).map((r) => ({
      ...r,
      importacao_id: importacaoId,
    }));
    const { error } = await supabase
      .from("atendimentos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any, { onConflict: "source_record_key", ignoreDuplicates: true });
    if (error) throw error;
    onProgress({
      stage: "salvando",
      processed: Math.min(i + BATCH_SIZE, novosRows.length),
      total: novosRows.length,
    });
  }

  // Atualiza o registro com os totais finais
  await supabase
    .from("importacoes")
    .update({ registros_novos: novosRows.length, duplicados, invalidos })
    .eq("id", importacaoId);

  const summary: ImportSummary = {
    totalLido: dataRows.length,
    novos: novosRows.length,
    duplicados,
    invalidos,
    periodoInicio,
    periodoFim,
    importacaoId,
  };

  onProgress({ stage: "concluido", processed: novosRows.length, total: novosRows.length });

  return summary;
}
