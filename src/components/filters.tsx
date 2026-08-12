import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filtroValoresQuery, type DashboardFilters } from "@/lib/dashboard-queries";

export type PeriodoPreset = "30d" | "90d" | "12m" | "custom";

const TODOS = "__todos";

function isoInicioDia(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.toISOString();
}

function isoFimDia(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c.toISOString();
}

function inputDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function periodoDe(preset: PeriodoPreset): { inicio: string; fim: string } {
  const fim = new Date();
  const inicio = new Date();
  if (preset === "90d") inicio.setDate(inicio.getDate() - 90);
  else if (preset === "12m") inicio.setMonth(inicio.getMonth() - 12);
  else inicio.setDate(inicio.getDate() - 30);
  return { inicio: isoInicioDia(inicio), fim: isoFimDia(fim) };
}

export interface FiltersState extends DashboardFilters {
  preset: PeriodoPreset;
}

export function filtrosIniciais(): FiltersState {
  const { inicio, fim } = periodoDe("30d");
  return {
    preset: "30d",
    dataInicio: inicio,
    dataFim: fim,
    conta: null,
    servico: null,
    agente: null,
    tipo: null,
    ativoReceptivo: null,
    status: null,
    recorrencia: null,
  };
}

export function useDashboardFilters() {
  const [state, setState] = useState<FiltersState>(filtrosIniciais);
  const filters = useMemo<DashboardFilters>(
    () => ({
      dataInicio: state.dataInicio,
      dataFim: state.dataFim,
      conta: state.conta,
      servico: state.servico,
      agente: state.agente,
      tipo: state.tipo,
      ativoReceptivo: state.ativoReceptivo,
      status: state.status,
      recorrencia: state.recorrencia,
    }),
    [state],
  );
  return { state, setState, filters };
}

interface SelectFiltroProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  loading?: boolean;
}

function SelectFiltro({ label, value, onChange, options, loading }: SelectFiltroProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value ?? TODOS}
        onValueChange={(v) => onChange(v === TODOS ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando…" : "Todos"} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={TODOS}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface FiltersProps {
  state: FiltersState;
  onChange: (state: FiltersState) => void;
}

export function Filters({ state, onChange }: FiltersProps) {
  const contas = useQuery(filtroValoresQuery("conta"));
  const servicos = useQuery(filtroValoresQuery("servico"));
  const agentes = useQuery(filtroValoresQuery("agente"));
  const status = useQuery(filtroValoresQuery("status"));

  const set = (patch: Partial<FiltersState>) => onChange({ ...state, ...patch });

  const mudarPreset = (preset: PeriodoPreset) => {
    if (preset === "custom") {
      set({ preset });
      return;
    }
    const { inicio, fim } = periodoDe(preset);
    set({ preset, dataInicio: inicio, dataFim: fim });
  };

  return (
    <div className="surface mb-6 space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={state.preset} onValueChange={(v) => mudarPreset(v as PeriodoPreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.preset === "custom" ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="f-inicio">
                Data início
              </Label>
              <Input
                id="f-inicio"
                type="date"
                value={inputDate(state.dataInicio)}
                onChange={(e) =>
                  e.target.value &&
                  set({ dataInicio: isoInicioDia(new Date(`${e.target.value}T12:00:00`)) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="f-fim">
                Data fim
              </Label>
              <Input
                id="f-fim"
                type="date"
                value={inputDate(state.dataFim)}
                onChange={(e) =>
                  e.target.value &&
                  set({ dataFim: isoFimDia(new Date(`${e.target.value}T12:00:00`)) })
                }
              />
            </div>
          </>
        ) : null}

        <SelectFiltro
          label="Conta"
          value={state.conta}
          onChange={(v) => set({ conta: v })}
          options={contas.data ?? []}
          loading={contas.isLoading}
        />
        <SelectFiltro
          label="Serviço"
          value={state.servico}
          onChange={(v) => set({ servico: v })}
          options={servicos.data ?? []}
          loading={servicos.isLoading}
        />
        <SelectFiltro
          label="Agente"
          value={state.agente}
          onChange={(v) => set({ agente: v })}
          options={agentes.data ?? []}
          loading={agentes.isLoading}
        />
        <SelectFiltro
          label="Tipo"
          value={state.tipo}
          onChange={(v) => set({ tipo: v })}
          options={["Humano", "Misto", "Automático"]}
        />
        <SelectFiltro
          label="Ativo/Receptivo"
          value={state.ativoReceptivo}
          onChange={(v) => set({ ativoReceptivo: v })}
          options={["Ativo", "Receptivo"]}
        />
        <SelectFiltro
          label="Status"
          value={state.status}
          onChange={(v) => set({ status: v })}
          options={status.data ?? []}
          loading={status.isLoading}
        />
        <SelectFiltro
          label="Recorrência"
          value={state.recorrencia}
          onChange={(v) => set({ recorrencia: v })}
          options={["Rechamada", "Recorrente", "Reincid"]}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => onChange(filtrosIniciais())}>
          <RotateCcw className="mr-2 size-4" />
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
