import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  importAscFile,
  type ImportProgress,
  type ImportSummary,
} from "@/lib/asc-import";

const STAGE_LABEL: Record<string, string> = {
  idle: "Aguardando arquivo",
  lendo: "Lendo arquivo",
  validando: "Validando registros",
  duplicatas: "Identificando duplicatas",
  salvando: "Salvando no banco",
  concluido: "Concluído",
  erro: "Erro",
};

export function ImportDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    stage: "idle",
    processed: 0,
    total: 0,
  });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFile(file: File) {
    setRunning(true);
    setSummary(null);
    try {
      const result = await importAscFile(file, userId, setProgress);
      setSummary(result);
      if (result.processamentoPendente) {
        toast.warning(
          `Base importada: ${result.novos} novos registros. Os indicadores podem ser retomados em Gerenciar Base.`,
        );
      } else {
        toast.success(
          `Importação concluída: ${result.novos} novos registros de ${result.totalLido} lidos.`,
        );
      }
      queryClient.invalidateQueries();
    } catch (error) {
      setProgress({ stage: "erro", processed: 0, total: 0 });
      toast.error(error instanceof Error ? error.message : "Falha ao importar arquivo.");
    } finally {
      setRunning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const percent =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : running ? 5 : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        setOpen(next);
        if (!next) {
          setProgress({ stage: "idle", processed: 0, total: 0 });
          setSummary(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="size-4" />
          Adicionar Base de Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar base de dados</DialogTitle>
          <DialogDescription>
            Envie o relatório de atendimentos exportado da ASC. Formatos aceitos: CSV, XLS e XLSX.
            As colunas são reconhecidas automaticamente pelo cabeçalho.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {progress.stage === "idle" && !summary ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors hover:border-gold hover:bg-muted"
          >
            <FileSpreadsheet className="size-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Clique para selecionar o arquivo
            </span>
            <span className="text-xs text-muted-foreground">
              Processamento em lotes de 500 registros
            </span>
          </button>
        ) : null}

        {progress.stage !== "idle" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{STAGE_LABEL[progress.stage]}</span>
              <span className="text-muted-foreground">
                {progress.total > 0
                  ? `${progress.processed.toLocaleString("pt-BR")} / ${progress.total.toLocaleString("pt-BR")}`
                  : ""}
              </span>
            </div>
            <Progress value={progress.stage === "concluido" ? 100 : percent} />
            {progress.message ? (
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <div className="surface space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {summary.processamentoPendente ? (
                <AlertTriangle className="size-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="size-4 text-gold" />
              )}
              {summary.processamentoPendente
                ? "Base importada · indicadores pendentes"
                : "Resumo da importação"}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Total lido", summary.totalLido],
                ["Novos", summary.novos],
                ["Duplicados", summary.duplicados],
                ["Inválidos", summary.invalidos],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {Number(value).toLocaleString("pt-BR")}
                  </dd>
                </div>
              ))}
            </dl>
            {summary.aviso ? (
              <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-muted-foreground">
                {summary.aviso}
                <br />
                Acesse <strong>Gerenciar Base</strong> e use <strong>Finalizar indicadores</strong>. Não é necessário importar o arquivo novamente.
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
