import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  atendimentosQuery,
  buscarAtendimentosExport,
  type AtendimentoLinha,
  type DashboardFilters,
} from "@/lib/dashboard-queries";

const POR_PAGINA = 50;

const COLUNAS: { chave: keyof AtendimentoLinha; titulo: string }[] = [
  { chave: "data_entrada", titulo: "Data" },
  { chave: "protocolo", titulo: "Protocolo" },
  { chave: "contato", titulo: "Contato" },
  { chave: "telefone", titulo: "Telefone" },
  { chave: "agente", titulo: "Agente" },
  { chave: "conta", titulo: "Conta" },
  { chave: "servico", titulo: "Serviço" },
  { chave: "tipo", titulo: "Tipo" },
  { chave: "ativo_receptivo", titulo: "Ativo/Receptivo" },
  { chave: "status", titulo: "Status" },
  { chave: "tempo_em_fila", titulo: "TME" },
  { chave: "tempo_atendimento", titulo: "TMA" },
  { chave: "recorrencia_origem", titulo: "Recorrência" },
];

export function AtendimentosTable({ filters }: { filters: DashboardFilters }) {
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);


  const { data, isPending } = useQuery(atendimentosQuery(filters, busca, pagina, POR_PAGINA));
  const linhas = data ?? [];
  const total = Number(linhas[0]?.total_count ?? 0);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));


  const formatarData = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  return (
    <div className="surface mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Atendimentos detalhados</h3>
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPagina(1);
              setBusca(buscaInput);
            }}
          >
            <Input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Protocolo, contato ou agente"
              className="w-64"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
              <Search className="size-4" />
            </Button>
          </form>
          <ExportButton
            filename={`gav-atendimentos-detalhados-${exportDateSuffix()}`}
            sheetName="Atendimentos detalhados"
            fetchData={async () => {
              const dados = await buscarAtendimentosExport(filters, busca);
              return withDashboardFilters(
                filters,
                dados.map((linha) => {
                  const row: Record<string, unknown> = {};
                  for (const coluna of COLUNAS) {
                    row[coluna.titulo] = linha[coluna.chave];
                  }
                  return row;
                }),
              );
            }}
          />
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum atendimento encontrado com os filtros selecionados.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUNAS.map((c) => (
                    <TableHead key={c.chave} className="whitespace-nowrap">
                      {c.titulo}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatarData(linha.data_entrada)}
                    </TableCell>
                    {COLUNAS.slice(1).map((c) => (
                      <TableCell key={c.chave} className="whitespace-nowrap">
                        {(linha[c.chave] as string | null) ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {total.toLocaleString("pt-BR")} registros · página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
