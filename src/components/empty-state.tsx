import { Database } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title = "Nenhuma base de dados carregada",
  description = "Importe um arquivo de atendimentos da ASC (CSV, XLS ou XLSX) para começar a análise.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        {icon ?? <Database className="size-6" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
