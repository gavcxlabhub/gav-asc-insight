import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, DatabaseZap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ImportDialog } from "@/components/import-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importacoesQuery, totalAtendimentosQuery } from "@/lib/analytics-queries";

export const Route = createFileRoute("/_authenticated/gerenciar")({
  head: () => ({
    meta: [
      { title: "Gerenciar Base — GAV ASC Analytics" },
      {
        name: "description",
        content: "Importação e histórico das bases de atendimentos ASC da GAV Resorts.",
      },
      { property: "og:title", content: "Gerenciar Base — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Importação e histórico das bases de atendimentos ASC.",
      },
    ],
  }),
  component: GerenciarBase,
});

function GerenciarBase() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const importacoes = useQuery(importacoesQuery());
  const total = useQuery(totalAtendimentosQuery());

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("importacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Importação removida junto com seus atendimentos.");
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Gerenciar Base" />
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar a base de dados."
        />
      </>
    );
  }

  const lista = importacoes.data ?? [];
  const formatarData = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  return (
    <>
      <PageHeader
        title="Gerenciar Base"
        description={`Histórico de importações · ${(total.data ?? 0).toLocaleString("pt-BR")} atendimentos armazenados.`}
        actions={user ? <ImportDialog userId={user.id} /> : null}
      />

      {lista.length === 0 ? (
        <EmptyState
          icon={<DatabaseZap className="size-6" />}
          action={user ? <ImportDialog userId={user.id} /> : null}
        />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Importado em</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Lidos</TableHead>
                <TableHead className="text-right">Novos</TableHead>
                <TableHead className="text-right">Duplicados</TableHead>
                <TableHead className="text-right">Inválidos</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="font-medium">{imp.nome_arquivo ?? "—"}</TableCell>
                  <TableCell>{formatarData(imp.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {imp.periodo_inicio
                      ? `${new Date(imp.periodo_inicio).toLocaleDateString("pt-BR")} → ${
                          imp.periodo_fim
                            ? new Date(imp.periodo_fim).toLocaleDateString("pt-BR")
                            : "—"
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">{imp.total_lido ?? 0}</TableCell>
                  <TableCell className="text-right">{imp.registros_novos ?? 0}</TableCell>
                  <TableCell className="text-right">{imp.duplicados ?? 0}</TableCell>
                  <TableCell className="text-right">{imp.invalidos ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover importação"
                      onClick={() => remover.mutate(imp.id)}
                      disabled={remover.isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
