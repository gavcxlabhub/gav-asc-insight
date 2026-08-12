import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

export const CHART_TOOLTIP = {
  contentStyle: {
    background: "#1C324B",
    border: "1px solid #223B5A",
    borderRadius: 8,
    color: "#F3EEDF",
  },
  labelStyle: { color: "#F3EEDF" },
  itemStyle: { color: "#F3EEDF" },
} as const;

export const CHART_COLORS = {
  gold: "#C9A968",
  goldDark: "#B8935A",
  muted: "#A9B4C4",
  slate: "#6E8098",
  cream: "#E0CE9E",
};

export const AXIS_TICK = { fontSize: 11, fill: "#A9B4C4" } as const;

interface AnalyticsChartCardProps {
  titulo: string;
  loading: boolean;
  vazio: boolean;
  acoes?: ReactNode;
  children: ReactNode;
  altura?: number;
}

export function AnalyticsChartCard({
  titulo,
  loading,
  vazio,
  acoes,
  children,
  altura = 280,
}: AnalyticsChartCardProps) {
  return (
    <div className="surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-foreground">{titulo}</h3>
        {acoes}
      </div>
      {loading ? (
        <Skeleton style={{ height: altura }} className="w-full" />
      ) : vazio ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height: altura }}
        >
          Sem dados no período e filtros selecionados.
        </div>
      ) : (
        <div style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
