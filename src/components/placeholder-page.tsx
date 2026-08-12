import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { totalAtendimentosQuery } from "@/lib/analytics-queries";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  nota: string;
}

export function PlaceholderPage({ title, description, icon: Icon, nota }: PlaceholderPageProps) {
  const total = useQuery(totalAtendimentosQuery());
  const temBase = (total.data ?? 0) > 0;

  return (
    <>
      <PageHeader title={title} description={description} />
      {temBase ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
            <Icon className="size-6" />
          </div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{nota}</p>
        </div>
      ) : (
        <EmptyState icon={<Icon className="size-6" />} />
      )}
    </>
  );
}
