import { useState } from "react";
import { Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatarDuracao,
  kpisQuery,
  percentual,
  type DashboardFilters,
} from "@/lib/dashboard-queries";

interface CardProps {
  titulo: string;
  valor: string;
  detalhe?: string;
  detalhe2?: string;
  loading: boolean;
  tooltip?: string;
}

function KpiCard({ titulo, valor, detalhe, detalhe2, loading, tooltip }: CardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="surface p-5 relative">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        {tooltip && (
          <div className="relative flex-shrink-0">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Informação sobre ${titulo}`}
            >
              <Info className="size-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-6 z-50 w-64 rounded-lg border border-border bg-[#1C324B] p-3 text-xs text-[#F3EEDF] shadow-xl">
                <div className="absolute -top-1.5 right-1 size-3 rotate-45 border-l border-t border-border bg-[#1C324B]" />
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{valor}</p>
          {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
          {detalhe2 ? <p className="mt-0.5 text-xs text-amber-400/80">{detalhe2}</p> : null}
        </>
      )}
    </div>
  );
}

export function KpiCards({ filters }: { filters: DashboardFilters }) {
  const { data, isPending, isError, error } = useQuery(kpisQuery(filters));

  if (isError) {
    return (
      <div className="surface border border-red-500/40 p-5 text-sm text-red-200">
        Não foi possível carregar os indicadores. {error instanceof Error ? error.message : "Erro na consulta dos KPIs."}
      </div>
    );
  }
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
  const total = data?.total ?? 0;
  const comHumano = data?.com_humano ?? data?.humanos ?? 0;
  const totalAutomacao = data?.automacao ?? ((data?.automaticos ?? 0) + (data?.notificacoes ?? 0));
  const automacao = total ? (totalAutomacao / total) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titulo="Total de atendimentos"
        valor={n(total)}
        loading={isPending}
        tooltip="Quantidade total de registros no período e filtros selecionados, incluindo Humano, Misto, Automático e Notificação."
      />
      <KpiCard
        titulo="Com humano / Automação"
        valor={`${n(comHumano)} / ${n(totalAutomacao)}`}
        detalhe={`Automático: ${n(data?.automaticos)} · Notificação: ${n(data?.notificacoes)}`}
        loading={isPending}
        tooltip="Com Humano: atendimentos onde um agente humano participou (Humano + Misto). Automação: registros do tipo Automático + Notificação, sem participação humana."
      />
      <KpiCard
        titulo="% Automação"
        valor={`${automacao.toFixed(1).replace(".", ",")}%`}
        detalhe={`${n(totalAutomacao)} registros de automação`}
        loading={isPending}
        tooltip="Percentual de registros sem participação humana, considerando os tipos Automático e Notificação informados pela ASC."
      />
      <KpiCard
        titulo="Ativos / Receptivos"
        valor={`${n(data?.ativos)} / ${n(data?.receptivos)}`}
        loading={isPending}
        tooltip="Ativo: a empresa entrou em contato com o cliente (ex: notificações, campanhas, follow-up). Receptivo: o cliente entrou em contato com a empresa por iniciativa própria."
      />
      <KpiCard
        titulo="TME médio"
        valor={formatarDuracao(data?.tme_segundos)}
        detalhe="Tempo médio em fila"
        loading={isPending}
        tooltip="Tempo Médio de Espera (TME): tempo médio que o cliente aguardou na fila antes de ser atendido. Quanto menor, melhor a experiência do cliente."
      />
      <KpiCard
        titulo="TMA médio"
        valor={formatarDuracao(data?.tma_segundos)}
        detalhe="Tempo médio de atendimento"
        loading={isPending}
        tooltip="Tempo Médio de Atendimento (TMA): tempo médio que durou cada atendimento após o início. Valores muito altos podem indicar complexidade ou falta de preparo do agente."
      />
      <KpiCard
        titulo="Primeira resposta"
        valor={formatarDuracao(data?.tpr_segundos)}
        detalhe="Da fila até a 1ª mensagem do agente"
        loading={isPending}
        tooltip="Tempo de Primeira Resposta (TPR): tempo entre o cliente entrar na fila e receber a primeira mensagem do agente humano. Indica a agilidade da equipe em iniciar o atendimento."
      />
      <KpiCard
        titulo="Rechamadas"
        valor={n(data?.sys_rechamadas)}
        detalhe={`${percentual(data?.sys_rechamadas ?? 0, total)} do período (sistema)`}
        detalhe2={`ASC informa: ${n(data?.asc_rechamadas)}`}
        loading={isPending}
        tooltip="Clientes que voltaram a entrar em contato em menos de 24 horas após o atendimento anterior. Alta taxa pode indicar que o problema não foi resolvido no primeiro contato. O sistema calcula pelo histórico de telefone; a ASC calcula pelo protocolo."
      />
      <KpiCard
        titulo="Recorrentes"
        valor={n(data?.sys_recorrentes)}
        detalhe={`${percentual(data?.sys_recorrentes ?? 0, total)} do período (sistema)`}
        detalhe2={`ASC informa: ${n(data?.asc_recorrentes)}`}
        loading={isPending}
        tooltip="Clientes que voltaram a entrar em contato entre 30 e 90 dias após o último atendimento. Indica clientes que têm necessidades recorrentes ou problemas não resolvidos definitivamente."
      />
      <KpiCard
        titulo="Reincidentes"
        valor={n(data?.sys_reincidentes)}
        detalhe={`${percentual(data?.sys_reincidentes ?? 0, total)} do período (sistema)`}
        detalhe2={`ASC informa: ${n(data?.asc_reincidentes)}`}
        loading={isPending}
        tooltip="Clientes que voltaram a entrar em contato entre 1 e 30 dias após o último atendimento. Pode indicar resolução parcial do problema ou surgimento de nova demanda relacionada."
      />
    </div>
  );
}
