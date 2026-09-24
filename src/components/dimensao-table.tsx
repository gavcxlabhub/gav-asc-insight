import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import {
  detalhesDimensaoQuery,
  formatarDuracao,
  percentual,
  type DashboardFilters,
  type DimensaoDetalhe,
  type DetalheDimensaoLinha,
} from "@/lib/dashboard-queries";

export type ColunaChave =
  | "total"
  | "percentual"
  | "humanos"
  | "mistos"
  | "automaticos"
  | "pct_ia"
  | "ativos"
  | "receptivos"
  | "rechamadas"
  | "pct_rechamada"
  | "recorrentes"
  | "pct_recorrencia"
  | "reincidentes"
  | "pct_reincidencia"
  | "tme_segundos"
  | "tma_segundos";

interface Coluna {
  chave: ColunaChave;
  titulo: string;
}

interface DimensaoTableProps {
  filters: DashboardFilters;
  dimensao: DimensaoDetalhe;
  rotuloColuna: string;
  colunas: Coluna[];
  excluirVazios: boolean;
}

function getCellValue(row: DetalheDimensaoLinha & { percentual_total?: number }, chave: ColunaChave, total: number): string {
  switch (chave) {
    case "total": return (row.total ?? 0).toLocaleString("pt-BR");
    case "percentual": return percentual(row.total ?? 0, total);
    case "humanos": return (row.humanos ?? 0).toLocaleString("pt-BR");
    case "mistos": return (row.mistos ?? 0).toLocaleString("pt-BR");
    case "automaticos": return (row.automaticos ?? 0).toLocaleString("pt-BR");
    case "pct_ia": {
      const elegiveis = (row.automaticos ?? 0) + (row.humanos ?? 0);
      return percentual(row.automaticos ?? 0, elegiveis);
    }
    case "ativos": return (row.ativos ?? 0).toLocaleString("pt-BR");
    case "receptivos": return (row.receptivos ?? 0).toLocaleString("pt-BR");
    case "rechamadas": return (row.rechamadas ?? 0).toLocaleString("pt-BR");
    case "pct_rechamada": return percentual(row.rechamadas ?? 0, row.total ?? 0);
    case "recorrentes": return (row.recorrentes ?? 0).toLocaleString("pt-BR");
    case "pct_recorrencia": return percentual(row.recorrentes ?? 0, row.total ?? 0);
    case "reincidentes": return (row.reincidentes ?? 0).toLocaleString("pt-BR");
    case "pct_reincidencia": return percentual(row.reincidentes ?? 0, row.total ?? 0);
    case "tme_segundos": return formatarDuracao(row.tme_segundos);
    case "tma_segundos": return formatarDuracao(row.tma_segundos);
    default: return "—";
  }
}

function getSortValue(row: DetalheDimensaoLinha, chave: ColunaChave): number {
  switch (chave) {
    case "total": return row.total ?? 0;
    case "humanos": return row.humanos ?? 0;
    case "mistos": return row.mistos ?? 0;
    case "automaticos": return row.automaticos ?? 0;
    case "pct_ia": {
      const elegiveis = (row.automaticos ?? 0) + (row.humanos ?? 0);
      return elegiveis ? (row.automaticos ?? 0) / elegiveis : 0;
    }
    case "ativos": return row.ativos ?? 0;
    case "receptivos": return row.receptivos ?? 0;
    case "rechamadas": return row.rechamadas ?? 0;
    case "pct_rechamada": return (row.rechamadas ?? 0) / Math.max(row.total ?? 1, 1);
    case "recorrentes": return row.recorrentes ?? 0;
    case "pct_recorrencia": return (row.recorrentes ?? 0) / Math.max(row.total ?? 1, 1);
    case "reincidentes": return row.reincidentes ?? 0;
    case "pct_reincidencia": return (row.reincidentes ?? 0) / Math.max(row.total ?? 1, 1);
    case "tme_segundos": return row.tme_segundos ?? 0;
    case "tma_segundos": return row.tma_segundos ?? 0;
    default: return 0;
  }
}

export function DimensaoTable({
  filters,
  dimensao,
  rotuloColuna,
  colunas,
  excluirVazios,
}: DimensaoTableProps) {
  const [sortChave, setSortChave] = useState<ColunaChave>("total");
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isPending } = useQuery(detalhesDimensaoQuery(filters, dimensao, 200));

  const rows = (data ?? []).filter((r) => !excluirVazios || r.rotulo !== "Sem agente");
  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);

  const sorted = [...rows].sort((a, b) => {
    const diff = getSortValue(a, sortChave) - getSortValue(b, sortChave);
    return sortAsc ? diff : -diff;
  });

  function toggleSort(chave: ColunaChave) {
    if (sortChave === chave) setSortAsc((v) => !v);
    else { setSortChave(chave); setSortAsc(false); }
  }

  async function fetchExportData() {
    return withDashboardFilters(filters, sorted.map((row) => {
      const obj: Record<string, unknown> = { [rotuloColuna]: row.rotulo };
      for (const col of colunas) {
        obj[col.titulo] = getCellValue(row, col.chave, total);
      }
      return obj;
    }));
  }

  if (isPending) return <Skeleton className="h-64 w-full" />;

  if (sorted.length === 0) {
    return (
      <div className="surface flex items-center justify-center p-8 text-sm text-muted-foreground">
        Sem dados no período e filtros selecionados.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {sorted.length} {dimensao === "agente" ? "agentes" : dimensao === "servico" ? "serviços" : "contas"}
        </p>
        <ExportButton
          filename={`gav-${dimensao}-${exportDateSuffix()}`}
          sheetName={rotuloColuna}
          fetchData={fetchExportData}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">{rotuloColuna}</th>
              {colunas.map((col) => (
                <th key={col.chave} className="px-4 py-3 font-medium">
                  <button
                    onClick={() => toggleSort(col.chave)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.titulo}
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.rotulo} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{row.rotulo}</td>
                {colunas.map((col) => (
                  <td key={col.chave} className="px-4 py-2.5 text-right tabular-nums">
                    {getCellValue(row, col.chave, total)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
