-- Otimiza os KPIs e mantém a mesma regra de recorrência do sistema.
-- A classificação passa a ser gravada apenas em uma linha representativa por episódio,
-- evitando COUNT(DISTINCT ...) pesado a cada carregamento do dashboard.

CREATE OR REPLACE FUNCTION public.recalcular_recorrencia_sistema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.atendimentos
  SET recorrencia_sistema = NULL
  WHERE recorrencia_sistema IS NOT NULL;

  WITH base AS (
    SELECT
      id,
      telefone_normalizado,
      coalesce(nullif(trim(protocolo), ''), id::text) AS episodio,
      data_entrada,
      row_number() OVER (
        PARTITION BY
          telefone_normalizado,
          coalesce(nullif(trim(protocolo), ''), id::text)
        ORDER BY data_entrada, id
      ) AS rn
    FROM public.atendimentos
    WHERE telefone_normalizado IS NOT NULL
      AND data_entrada IS NOT NULL
  ),
  episodios AS (
    SELECT
      id AS representante_id,
      telefone_normalizado,
      episodio,
      data_entrada
    FROM base
    WHERE rn = 1
  ),
  sequencia AS (
    SELECT
      representante_id,
      telefone_normalizado,
      episodio,
      data_entrada,
      lag(data_entrada) OVER (
        PARTITION BY telefone_normalizado
        ORDER BY data_entrada, episodio
      ) AS data_anterior
    FROM episodios
  ),
  mapa AS (
    SELECT
      representante_id,
      CASE
        WHEN data_anterior IS NULL OR data_entrada <= data_anterior THEN NULL
        WHEN data_entrada - data_anterior < interval '24 hours' THEN 'Rechamada'
        WHEN data_entrada - data_anterior < interval '30 days' THEN 'Reincidente'
        WHEN data_entrada - data_anterior <= interval '90 days' THEN 'Recorrente'
        ELSE NULL
      END AS categoria
    FROM sequencia
  )
  UPDATE public.atendimentos a
  SET recorrencia_sistema = m.categoria
  FROM mapa m
  WHERE a.id = m.representante_id
    AND m.categoria IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_recorrencia_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_recorrencia_sistema() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_kpis(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'humanos', COUNT(*) FILTER (WHERE tipo IN ('Humano','Misto')),
    'mistos', COUNT(*) FILTER (WHERE tipo = 'Misto'),
    'automaticos', COUNT(*) FILTER (WHERE tipo = 'Automático'),
    'notificacoes', COUNT(*) FILTER (WHERE tipo = 'Notificação'),
    'automacao', COUNT(*) FILTER (WHERE tipo IN ('Automático','Notificação')),
    'com_humano', COUNT(*) FILTER (WHERE tipo IN ('Humano','Misto')),
    'ativos', COUNT(*) FILTER (WHERE ativo_receptivo = 'Ativo'),
    'receptivos', COUNT(*) FILTER (WHERE ativo_receptivo = 'Receptivo'),

    'asc_rechamadas', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%rechamada%'),
    'asc_recorrentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%recorrente%'),
    'asc_reincidentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%reincid%'),

    'sys_rechamadas', COUNT(*) FILTER (WHERE recorrencia_sistema = 'Rechamada'),
    'sys_recorrentes', COUNT(*) FILTER (WHERE recorrencia_sistema = 'Recorrente'),
    'sys_reincidentes', COUNT(*) FILTER (WHERE recorrencia_sistema = 'Reincidente'),

    'rechamadas', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%rechamada%'),
    'recorrentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%recorrente%'),
    'reincidentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%reincid%'),

    'tme_segundos', AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval)))
      FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tma_segundos', AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval)))
      FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tpr_segundos', AVG(EXTRACT(EPOCH FROM (primeira_mensagem_agente - data_fila)))
      FILTER (
        WHERE primeira_mensagem_agente IS NOT NULL
          AND data_fila IS NOT NULL
          AND primeira_mensagem_agente > data_fila
      )
  ) INTO result
  FROM public.atendimentos
  WHERE data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR conta = p_conta)
    AND (p_servico IS NULL OR servico = p_servico)
    AND (p_agente IS NULL OR agente = p_agente)
    AND public.tipo_match(p_tipo, tipo)
    AND (p_ativo_receptivo IS NULL OR ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR status = p_status)
    AND (p_recorrencia IS NULL OR recorrencia_origem ILIKE '%' || p_recorrencia || '%');

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;
