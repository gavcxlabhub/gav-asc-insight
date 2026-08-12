import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  detalhesDimensaoQuery,
  formatarDuracao,
  type DashboardFilters,
  type DetalheDimensaoLinha,
  type DimensaoDetalhe,
} from "@/lib/dashboard-queries";

export type ColunaChave =
  | keyof DetalheDimensaoLinha
  | "percentual"
  | "pct_rechamada"
  | "pct_recorrencia"
  | "pct_reincidencia";

interface Coluna {
  chave: ColunaChave;
  titulo: string;
}

interface DimensaoTableProps {
  filters: DashboardFilters;
  dimensao: DimensaoDetalhe;
  rotuloColuna: string;
  colunas: Coluna[];
  excluirVazios?: boolean;
  limite?: number;
}

function valorDe(linha: DetalheDimensaoLinha, chave: ColunaChave, total: number): number | string {
  switch (chave) {
    case "percentual":
      return total ? (linha.total / total) * 100 : 0;
    case "pct_rechamada":
      return linha.total ? (linha.rechamadas / linha.total) * 100 : 0;
    case "pct_recorrencia":
      return linha.total ? (linha.recorrentes / linha.total) * 100 : 0;
    case "pct_reincidencia":
      return linha.total ? (linha.reincidentes / linha.total) * 100 : 0;
    default: {
      const v = linha[chave];
      return v == null ? 0 : v;
    }
  }
}

function formatar(chave: ColunaChave, valor: number | string): string {
  if (typeof valor === "string") return valor;
  if (chave === "tme_segundos" || chave === "tma_segundos") return formatarDuracao(valor);
  if (chave.startsWith("pct_") || chave === "percentual")
    return `${valor.toFixed(1).replace(".", ",")}%`;
  return valor.toLocaleString("pt-BR");
}

export function DimensaoTable({
  filters,
  dimensao,
  rotuloColuna,
  colunas,
  excluirVazios,
  limite = 50,
}: DimensaoTableProps) {
  const { data, isPending } = useQuery(detalhesDimensaoQuery(filters, dimensao, limite));
  const [ordem, setOrdem] = useState<{ chave: ColunaChave; asc: boolean }>({
    chave: "total",
    asc: false,
  });

  const linhas = useMemo(() => {
    let base = data ?? [];
    if (excluirVazios) {
      base = base.filter(
        (l) => l.rotulo.trim() !== "" && !l.rotulo.toLowerCase().startsWith("sem "),
      );
    }
    const total = base.reduce((acc, l) => acc + l.total, 0);
    const ordenadas = [...base].sort((a, b) => {
      if (ordem.chave === "rotulo") {
        return ordem.asc ? a.rotulo.localeCompare(b.rotulo) : b.rotulo.localeCompare(a.rotulo);
      }
      const va = valorDe(a, ordem.chave, total) as number;
      const vb = valorDe(b, ordem.chave, total) as number;
      return ordem.asc ? va - vb : vb - va;
    });
    return { linhas: ordenadas, total };
  }, [data, excluirVazios, ordem]);

  function alternar(chave: ColunaChave) {
    setOrdem((o) => (o.chave === chave ? { chave, asc: !o.asc } : { chave, asc: false }));
  }

  if (isPending) {
    return (
      <div className="surface space-y-3 p-5">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (linhas.linhas.length === 0) {
    return (
      <div className="surface p-10 text-center text-sm text-muted-foreground">
        Sem dados no período e filtros selecionados.
      </div>
    );
  }

  const todas: Coluna[] = [{ chave: "rotulo", titulo: rotuloColuna }, ...colunas];

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-border">
            {todas.map((c) => {
              const ativo = ordem.chave === c.chave;
              return (
                <th
                  key={c.chave}
                  className={cn(
                    "whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    c.chave === "rotulo" ? "text-left" : "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => alternar(c.chave)}
                    className={cn(
                      "inline-flex items-center gap-1 transition-colors hover:text-gold",
                      ativo && "text-gold",
                    )}
                  >
                    {c.titulo}
                    {ativo ? (
                      ordem.asc ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-border/60 last:border-0">
              {todas.map((c) => (
                <td
                  key={c.chave}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5",
                    c.chave === "rotulo"
                      ? "text-left font-medium text-foreground"
                      : "text-right text-muted-foreground",
                  )}
                >
                  {formatar(c.chave, valorDe(l, c.chave, linhas.total))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
