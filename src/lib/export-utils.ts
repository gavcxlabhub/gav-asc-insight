import type { DashboardFilters } from "@/lib/dashboard-queries";

export function dashboardFilterMetadata(filters: DashboardFilters): Record<string, unknown> {
  return {
    "Período início": filters.dataInicio ?? "",
    "Período fim": filters.dataFim ?? "",
    Conta: filters.conta ?? "Todos",
    Serviço: filters.servico ?? "Todos",
    Agente: filters.agente ?? "Todos",
    Tipo: filters.tipo ?? "Todos",
    "Ativo/Receptivo": filters.ativoReceptivo ?? "Todos",
    Status: filters.status ?? "Todos",
    Recorrência: filters.recorrencia ?? "Todos",
  };
}

export function withDashboardFilters(
  filters: DashboardFilters,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const meta = dashboardFilterMetadata(filters);
  return rows.map((row) => ({ ...meta, ...row }));
}

export function exportDateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}
