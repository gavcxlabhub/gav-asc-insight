import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export-button";
import { exportDateSuffix, withDashboardFilters } from "@/lib/export-utils";
import {
  frequenciaContatosQuery,
  topClientesContatosQuery,
  type DashboardFilters,
} from "@/lib/dashboard-queries";

function Card({
  titulo,
  valor,
  detalhe,
  destaque,
  filters,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  filters: DashboardFilters;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <ExportButton
          compact
          filename={`gav-${titulo}-${exportDateSuffix()}`}
          sheetName={titulo}
          fetchData={() =>
            withDashboardFilters(filters, [
              { Indicador: titulo, Valor: valor, Detalhe: detalhe ?? "" },
            ])
          }
        />
      </div>
      <p className={`mt-2 font-display text-3xl font-bold ${destaque ? "text-amber-300" : "text-foreground"}`}>
        {valor}
      </p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

export function FrequenciaContatos({ filters }: { filters: DashboardFilters }) {
  const frequencia = useQuery(frequenciaContatosQuery(filters));
  const top = useQuery(topClientesContatosQuery(filters, 15));
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

  if (frequencia.isError) {
    return (
      <div className="surface border border-red-500/40 p-5 text-sm text-red-200">
        Não foi possível carregar a frequência de contatos.{" "}
        {frequencia.error instanceof Error ? frequencia.error.message : "Erro na consulta."}
      </div>
    );
  }

  const d = frequencia.data;
  const clientes = d?.clientes_unicos ?? 0;
  const pct = (v: number | null | undefined) =>
    clientes ? `${(((v ?? 0) / clientes) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-lg font-bold text-foreground">
          Frequência de contato dos clientes
        </h2>
        <p className="text-sm text-muted-foreground">
          Quantas vezes cada telefone voltou a gerar atendimento dentro do período e filtros selecionados.
        </p>
      </div>

      {frequencia.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card filters={filters} titulo="Clientes únicos" valor={n(d?.clientes_unicos)} detalhe="Telefones distintos" />
          <Card
            filters={filters}
            titulo="Média de contatos"
            valor={Number(d?.media_contatos ?? 0).toFixed(2).replace(".", ",")}
            detalhe="Atendimentos por cliente"
          />
          <Card filters={filters} titulo="1 contato" valor={n(d?.um_contato)} detalhe={pct(d?.um_contato)} />
          <Card filters={filters} titulo="2 contatos" valor={n(d?.dois_contatos)} detalhe={pct(d?.dois_contatos)} />
          <Card filters={filters} titulo="3 contatos" valor={n(d?.tres_contatos)} detalhe={pct(d?.tres_contatos)} />
          <Card filters={filters} titulo="4+ contatos" valor={n(d?.quatro_mais)} detalhe={pct(d?.quatro_mais)} />
          <Card
            filters={filters}
            titulo="5+ contatos"
            valor={n(d?.cinco_mais)}
            detalhe="Clientes de alta frequência"
            destaque
          />
        </div>
      )}

      <div className="surface overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">
              Clientes com maior número de contatos
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Telefone mascarado. As categorias de retorno usam o cálculo de recorrência do sistema.
            </p>
          </div>
          {(top.data ?? []).length > 0 ? (
            <ExportButton
              compact
              filename={`gav-clientes-maior-contato-${exportDateSuffix()}`}
              sheetName="Clientes com mais contatos"
              fetchData={() =>
                withDashboardFilters(
                  filters,
                  (top.data ?? []).map((row, index) => ({
                    Posição: index + 1,
                    Cliente: row.telefone_mascarado,
                    Contatos: row.contatos,
                    Rechamadas: row.rechamadas,
                    Reincidências: row.reincidentes,
                    Recorrências: row.recorrentes,
                    "Serviço principal": row.servico_principal ?? "",
                  })),
                )
              }
            />
          ) : null}
        </div>

        {top.isPending ? (
          <div className="p-4"><Skeleton className="h-72 w-full" /></div>
        ) : top.isError ? (
          <div className="p-6 text-sm text-red-200">
            Não foi possível carregar o ranking. {top.error instanceof Error ? top.error.message : ""}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium">Contatos</th>
                  <th className="px-4 py-3 text-right font-medium">Rechamadas</th>
                  <th className="px-4 py-3 text-right font-medium">Reincidências</th>
                  <th className="px-4 py-3 text-right font-medium">Recorrências</th>
                  <th className="px-4 py-3 font-medium">Serviço principal</th>
                </tr>
              </thead>
              <tbody>
                {(top.data ?? []).map((row, i) => (
                  <tr key={`${row.telefone_mascarado}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.telefone_mascarado}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{n(row.contatos)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n(row.rechamadas)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n(row.reincidentes)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n(row.recorrentes)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.servico_principal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
