import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, DatabaseZap, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
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
import {
  importacoesQuery,
  periodoBaseQuery,
  totalAtendimentosQuery,
  type ImportacaoResumo,
} from "@/lib/analytics-queries";
import {
  finalizarIndicadoresImportacao,
  type PostProcessProgress,
} from "@/lib/import-post-process";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const periodo = useQuery(periodoBaseQuery());
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [processamento, setProcessamento] = useState<PostProcessProgress | null>(null);

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

  const finalizarIndicadores = useMutation({
    mutationFn: async (imp: ImportacaoResumo) => {
      if (!imp.periodo_inicio || !imp.periodo_fim) {
        throw new Error("A importação não possui período válido para atualizar os indicadores.");
      }

      setProcessandoId(imp.id);
      setProcessamento({
        etapa: "recorrencia",
        processados: 0,
        total: 1,
        mensagem: "Preparando retomada dos indicadores…",
      });

      await finalizarIndicadoresImportacao({
        importacaoId: imp.id,
        periodoInicio: imp.periodo_inicio,
        periodoFim: imp.periodo_fim,
        onProgress: setProcessamento,
      });
    },
    onSuccess: async () => {
      toast.success("Indicadores atualizados com sucesso.");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(`Não foi possível concluir os indicadores: ${error.message}`);
    },
    onSettled: () => {
      setProcessandoId(null);
      setProcessamento(null);
    },
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de registros</p>
          <p className="mt-2 text-2xl font-semibold">
            {(total.data ?? 0).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Período coberto</p>
          <p className="mt-2 text-2xl font-semibold">
            {periodo.data?.inicio
              ? `${new Date(periodo.data.inicio).toLocaleDateString("pt-BR")} → ${
                  periodo.data.fim
                    ? new Date(periodo.data.fim).toLocaleDateString("pt-BR")
                    : "—"
                }`
              : "—"}
          </p>
        </div>
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Última importação</p>
          <p className="mt-2 text-2xl font-semibold">
            {lista[0]?.created_at
              ? new Date(lista[0].created_at).toLocaleString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>

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
                <TableHead>Indicadores</TableHead>
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
                  <TableCell className="min-w-[250px]">
                    {imp.processamento_status === "concluido" || !imp.processamento_status ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        Concluídos
                      </div>
                    ) : imp.processamento_etapa === "importacao" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                          <AlertTriangle className="size-4" />
                          Importação incompleta
                        </div>
                        {imp.processamento_mensagem ? (
                          <p className="max-w-[300px] text-[11px] leading-relaxed text-muted-foreground">
                            {imp.processamento_mensagem}
                          </p>
                        ) : null}
                        <p className="max-w-[300px] text-[11px] font-medium leading-relaxed text-foreground">
                          Use “Adicionar Base de Dados” e selecione o mesmo arquivo. O sistema continuará sem duplicar os registros já salvos.
                        </p>
                      </div>
                    ) : processandoId === imp.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                          <RefreshCw className="size-4 animate-spin" />
                          Processando indicadores
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {processamento?.mensagem ?? "Atualizando indicadores…"}
                        </p>
                        {processamento && processamento.total > 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            {processamento.processados.toLocaleString("pt-BR")} /{" "}
                            {processamento.total.toLocaleString("pt-BR")}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                          <AlertTriangle className="size-4" />
                          Indicadores pendentes
                        </div>
                        {imp.processamento_mensagem ? (
                          <p className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
                            {imp.processamento_mensagem}
                          </p>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => finalizarIndicadores.mutate(imp)}
                          disabled={finalizarIndicadores.isPending}
                        >
                          <RefreshCw className="size-3.5" />
                          Finalizar indicadores
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover importação"
                          disabled={remover.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir importação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os atendimentos vinculados a{" "}
                            {imp.nome_arquivo ?? "este arquivo"} serão removidos
                            permanentemente da base.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remover.mutate(imp.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
