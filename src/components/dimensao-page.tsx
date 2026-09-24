import { PageHeader } from "@/components/page-header";
import { Filters, useDashboardFilters } from "@/components/filters";
import { DimensaoTable, type ColunaChave } from "@/components/dimensao-table";
import type { DimensaoDetalhe } from "@/lib/dashboard-queries";

const COLUNAS_PADRAO: { chave: ColunaChave; titulo: string }[] = [
  { chave: "total", titulo: "Volume" },
  { chave: "percentual", titulo: "%" },
  { chave: "humanos", titulo: "Com Humano" },
  { chave: "automaticos", titulo: "Automação" },
  { chave: "ativos", titulo: "Ativos" },
  { chave: "receptivos", titulo: "Receptivos" },
  { chave: "tme_segundos", titulo: "TME" },
  { chave: "tma_segundos", titulo: "TMA" },
  { chave: "rechamadas", titulo: "Rechamadas" },
  { chave: "pct_rechamada", titulo: "% Rechamada" },
  { chave: "recorrentes", titulo: "Recorrentes" },
  { chave: "pct_recorrencia", titulo: "% Recorrência" },
  { chave: "reincidentes", titulo: "Reincidentes" },
  { chave: "pct_reincidencia", titulo: "% Reincidência" },
];

const COLUNAS_AGENTE: { chave: ColunaChave; titulo: string }[] = [
  { chave: "total", titulo: "Volume" },
  { chave: "percentual", titulo: "%" },
  { chave: "humanos", titulo: "Com Humano" },
  { chave: "ativos", titulo: "Ativos" },
  { chave: "receptivos", titulo: "Receptivos" },
  { chave: "tme_segundos", titulo: "TME" },
  { chave: "tma_segundos", titulo: "TMA" },
  { chave: "rechamadas", titulo: "Rechamadas" },
  { chave: "pct_rechamada", titulo: "% Rechamada" },
  { chave: "recorrentes", titulo: "Recorrentes" },
  { chave: "pct_recorrencia", titulo: "% Recorrência" },
  { chave: "reincidentes", titulo: "Reincidentes" },
  { chave: "pct_reincidencia", titulo: "% Reincidência" },
];

interface DimensaoPageProps {
  titulo: string;
  descricao: string;
  dimensao: DimensaoDetalhe;
  rotuloColuna: string;
  excluirVazios?: boolean;
}

export function DimensaoPage({
  titulo,
  descricao,
  dimensao,
  rotuloColuna,
  excluirVazios,
}: DimensaoPageProps) {
  const { state, setState, filters } = useDashboardFilters();
  const colunas = dimensao === "agente" ? COLUNAS_AGENTE : COLUNAS_PADRAO;
  return (
    <>
      <PageHeader title={titulo} description={descricao} />
      <Filters state={state} onChange={setState} />
      <DimensaoTable
        filters={filters}
        dimensao={dimensao}
        rotuloColuna={rotuloColuna}
        colunas={colunas}
        excluirVazios={excluirVazios ?? false}
      />
    </>
  );
}
