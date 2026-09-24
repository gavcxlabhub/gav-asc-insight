-- Camada analítica leve para impedir timeouts do dashboard.
-- A tabela bruta atendimentos continua sendo a fonte de verdade e permanece intacta.

CREATE TABLE IF NOT EXISTS public.atendimentos_resumo_analytics (
  dia date NOT NULL,
  hora smallint NOT NULL,
  dia_semana smallint NOT NULL,
  conta text,
  servico text,
  agente text,
  tipo text,
  ativo_receptivo text,
  status text,
  recorrencia_origem text,
  recorrencia_sistema text,
  total bigint NOT NULL,
  tme_soma double precision NOT NULL DEFAULT 0,
  tme_qtd bigint NOT NULL DEFAULT 0,
  tma_soma double precision NOT NULL DEFAULT 0,
  tma_qtd bigint NOT NULL DEFAULT 0,
  tpr_soma double precision NOT NULL DEFAULT 0,
  tpr_qtd bigint NOT NULL DEFAULT 0
);

REVOKE ALL ON public.atendimentos_resumo_analytics FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.atendimentos_resumo_analytics TO service_role;

CREATE INDEX IF NOT EXISTS idx_resumo_analytics_dia ON public.atendimentos_resumo_analytics (dia);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_conta ON public.atendimentos_resumo_analytics (conta);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_servico ON public.atendimentos_resumo_analytics (servico);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_agente ON public.atendimentos_resumo_analytics (agente);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_tipo ON public.atendimentos_resumo_analytics (tipo);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_ativo ON public.atendimentos_resumo_analytics (ativo_receptivo);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_status ON public.atendimentos_resumo_analytics (status);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_rec_asc ON public.atendimentos_resumo_analytics (recorrencia_origem);
CREATE INDEX IF NOT EXISTS idx_resumo_analytics_rec_sys ON public.atendimentos_resumo_analytics (recorrencia_sistema);

TRUNCATE public.atendimentos_resumo_analytics;

INSERT INTO public.atendimentos_resumo_analytics (
  dia, hora, dia_semana,
  conta, servico, agente, tipo, ativo_receptivo, status,
  recorrencia_origem, recorrencia_sistema,
  total, tme_soma, tme_qtd, tma_soma, tma_qtd, tpr_soma, tpr_qtd
)
SELECT
  (data_entrada AT TIME ZONE 'America/Sao_Paulo')::date,
  extract(hour from data_entrada AT TIME ZONE 'America/Sao_Paulo')::smallint,
  extract(isodow from data_entrada AT TIME ZONE 'America/Sao_Paulo')::smallint,
  conta, servico, agente, tipo, ativo_receptivo, status,
  recorrencia_origem, recorrencia_sistema,
  count(*)::bigint,
  coalesce(sum(CASE
    WHEN tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
    THEN extract(epoch from tempo_em_fila::interval)
    ELSE 0 END),0)::double precision,
  count(*) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$')::bigint,
  coalesce(sum(CASE
    WHEN tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
    THEN extract(epoch from tempo_atendimento::interval)
    ELSE 0 END),0)::double precision,
  count(*) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$')::bigint,
  coalesce(sum(CASE
    WHEN primeira_mensagem_agente IS NOT NULL
     AND data_fila IS NOT NULL
     AND primeira_mensagem_agente > data_fila
    THEN extract(epoch from (primeira_mensagem_agente - data_fila))
    ELSE 0 END),0)::double precision,
  count(*) FILTER (
    WHERE primeira_mensagem_agente IS NOT NULL
      AND data_fila IS NOT NULL
      AND primeira_mensagem_agente > data_fila
  )::bigint
FROM public.atendimentos
WHERE data_entrada IS NOT NULL
GROUP BY
  1,2,3,
  conta, servico, agente, tipo, ativo_receptivo, status,
  recorrencia_origem, recorrencia_sistema;

ANALYZE public.atendimentos_resumo_analytics;

CREATE OR REPLACE FUNCTION public.refresh_atendimentos_resumo(
  p_inicio date,
  p_fim date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_ts_inicio timestamptz;
  v_ts_fim timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio THEN
    RAISE EXCEPTION 'periodo invalido';
  END IF;

  v_ts_inicio := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  DELETE FROM public.atendimentos_resumo_analytics
  WHERE dia BETWEEN p_inicio AND p_fim;

  INSERT INTO public.atendimentos_resumo_analytics (
    dia, hora, dia_semana,
    conta, servico, agente, tipo, ativo_receptivo, status,
    recorrencia_origem, recorrencia_sistema,
    total, tme_soma, tme_qtd, tma_soma, tma_qtd, tpr_soma, tpr_qtd
  )
  SELECT
    (data_entrada AT TIME ZONE 'America/Sao_Paulo')::date,
    extract(hour from data_entrada AT TIME ZONE 'America/Sao_Paulo')::smallint,
    extract(isodow from data_entrada AT TIME ZONE 'America/Sao_Paulo')::smallint,
    conta, servico, agente, tipo, ativo_receptivo, status,
    recorrencia_origem, recorrencia_sistema,
    count(*)::bigint,
    coalesce(sum(CASE
      WHEN tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      THEN extract(epoch from tempo_em_fila::interval)
      ELSE 0 END),0)::double precision,
    count(*) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$')::bigint,
    coalesce(sum(CASE
      WHEN tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      THEN extract(epoch from tempo_atendimento::interval)
      ELSE 0 END),0)::double precision,
    count(*) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$')::bigint,
    coalesce(sum(CASE
      WHEN primeira_mensagem_agente IS NOT NULL
       AND data_fila IS NOT NULL
       AND primeira_mensagem_agente > data_fila
      THEN extract(epoch from (primeira_mensagem_agente - data_fila))
      ELSE 0 END),0)::double precision,
    count(*) FILTER (
      WHERE primeira_mensagem_agente IS NOT NULL
        AND data_fila IS NOT NULL
        AND primeira_mensagem_agente > data_fila
    )::bigint
  FROM public.atendimentos
  WHERE data_entrada >= v_ts_inicio
    AND data_entrada < v_ts_fim
  GROUP BY
    1,2,3,
    conta, servico, agente, tipo, ativo_receptivo, status,
    recorrencia_origem, recorrencia_sistema;

  ANALYZE public.atendimentos_resumo_analytics;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_atendimentos_resumo(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_atendimentos_resumo(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalcular_recorrencia_sistema_telefones(
  p_telefones text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_telefones IS NULL OR cardinality(p_telefones)=0 THEN
    RETURN;
  END IF;

  UPDATE public.atendimentos
  SET recorrencia_sistema = NULL
  WHERE telefone_normalizado = ANY(p_telefones)
    AND recorrencia_sistema IS NOT NULL;

  WITH base AS (
    SELECT
      id,
      telefone_normalizado,
      coalesce(nullif(trim(protocolo), ''), id::text) AS episodio,
      data_entrada,
      row_number() OVER (
        PARTITION BY telefone_normalizado, coalesce(nullif(trim(protocolo), ''), id::text)
        ORDER BY data_entrada, id
      ) AS rn
    FROM public.atendimentos
    WHERE telefone_normalizado = ANY(p_telefones)
      AND data_entrada IS NOT NULL
  ),
  episodios AS (
    SELECT id AS representante_id, telefone_normalizado, episodio, data_entrada
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

REVOKE ALL ON FUNCTION public.recalcular_recorrencia_sistema_telefones(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_recorrencia_sistema_telefones(text[]) TO authenticated;

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
DECLARE
  result jsonb;
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(total),0),
    'humanos', COALESCE(SUM(total) FILTER (WHERE tipo IN ('Humano','Misto')),0),
    'mistos', COALESCE(SUM(total) FILTER (WHERE tipo='Misto'),0),
    'automaticos', COALESCE(SUM(total) FILTER (WHERE tipo='Automático'),0),
    'notificacoes', COALESCE(SUM(total) FILTER (WHERE tipo='Notificação'),0),
    'automacao', COALESCE(SUM(total) FILTER (WHERE tipo IN ('Automático','Notificação')),0),
    'com_humano', COALESCE(SUM(total) FILTER (WHERE tipo IN ('Humano','Misto')),0),
    'ativos', COALESCE(SUM(total) FILTER (WHERE ativo_receptivo='Ativo'),0),
    'receptivos', COALESCE(SUM(total) FILTER (WHERE ativo_receptivo='Receptivo'),0),
    'asc_rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Rechamada'),0),
    'asc_recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Recorrente'),0),
    'asc_reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Reincidente'),0),
    'sys_rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Rechamada'),0),
    'sys_recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Recorrente'),0),
    'sys_reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Reincidente'),0),
    'rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Rechamada'),0),
    'recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Recorrente'),0),
    'reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Reincidente'),0),
    'tme_segundos', CASE WHEN COALESCE(SUM(tme_qtd),0)=0 THEN NULL ELSE SUM(tme_soma)/SUM(tme_qtd) END,
    'tma_segundos', CASE WHEN COALESCE(SUM(tma_qtd),0)=0 THEN NULL ELSE SUM(tma_soma)/SUM(tma_qtd) END,
    'tpr_segundos', CASE WHEN COALESCE(SUM(tpr_qtd),0)=0 THEN NULL ELSE SUM(tpr_soma)/SUM(tpr_qtd) END
  ) INTO result
  FROM public.atendimentos_resumo_analytics
  WHERE dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR conta=p_conta)
    AND (p_servico IS NULL OR servico=p_servico)
    AND (p_agente IS NULL OR agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND tipo IN ('Automático','Notificação'))
      OR tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR status=p_status)
    AND (
      p_recorrencia IS NULL
      OR (p_recorrencia='Reincid' AND recorrencia_origem='Reincidente')
      OR recorrencia_origem=p_recorrencia
    );

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_evolucao_volume(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_granularidade text DEFAULT 'dia',
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL
) RETURNS TABLE(periodo text, total bigint, humanos bigint, automaticos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    CASE WHEN p_granularidade='mes' THEN to_char(r.dia,'YYYY-MM') ELSE to_char(r.dia,'YYYY-MM-DD') END,
    SUM(r.total)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo IN ('Humano','Misto')),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo IN ('Automático','Notificação')),0)::bigint
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (p_servico IS NULL OR r.servico=p_servico)
    AND (p_agente IS NULL OR r.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
    AND (
      p_recorrencia IS NULL
      OR (p_recorrencia='Reincid' AND r.recorrencia_origem='Reincidente')
      OR r.recorrencia_origem=p_recorrencia
    )
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agrupado(
  p_dimensao text,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_limite integer DEFAULT 15,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL
) RETURNS TABLE(rotulo text, total bigint, humanos bigint, receptivos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente','tipo','ativo_receptivo','status','hora','dia_semana','recorrencia')
    THEN RAISE EXCEPTION 'dimensao invalida';
  END IF;

  RETURN QUERY
  SELECT
    CASE p_dimensao
      WHEN 'conta' THEN COALESCE(r.conta,'Sem conta')
      WHEN 'servico' THEN COALESCE(r.servico,'Sem serviço')
      WHEN 'agente' THEN COALESCE(r.agente,'Sem agente')
      WHEN 'tipo' THEN COALESCE(r.tipo,'Sem informação')
      WHEN 'ativo_receptivo' THEN COALESCE(r.ativo_receptivo,'Sem informação')
      WHEN 'status' THEN COALESCE(r.status,'Sem status')
      WHEN 'hora' THEN lpad(r.hora::text,2,'0')
      WHEN 'dia_semana' THEN r.dia_semana::text
      WHEN 'recorrencia' THEN COALESCE(r.recorrencia_origem,'Sem informação')
    END::text,
    SUM(r.total)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo IN ('Humano','Misto')),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.ativo_receptivo='Receptivo'),0)::bigint
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (p_servico IS NULL OR r.servico=p_servico)
    AND (p_agente IS NULL OR r.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
    AND (
      p_recorrencia IS NULL
      OR (p_recorrencia='Reincid' AND r.recorrencia_origem='Reincidente')
      OR r.recorrencia_origem=p_recorrencia
    )
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_filtro_valores(p_campo text)
RETURNS TABLE(valor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_campo NOT IN ('conta','servico','agente','status') THEN RAISE EXCEPTION 'campo invalido'; END IF;

  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT %I::text AS valor
       FROM public.atendimentos_resumo_analytics
      WHERE %I IS NOT NULL AND trim(%I::text) <> ''''
      ORDER BY 1',
    p_campo, p_campo, p_campo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recorrencia_periodo(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_granularidade text DEFAULT 'dia',
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL
) RETURNS TABLE(periodo text, rechamadas bigint, recorrentes bigint, reincidentes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    CASE WHEN p_granularidade='mes' THEN to_char(r.dia,'YYYY-MM') ELSE to_char(r.dia,'YYYY-MM-DD') END,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Rechamada'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Recorrente'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Reincidente'),0)::bigint
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (p_servico IS NULL OR r.servico=p_servico)
    AND (p_agente IS NULL OR r.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recorrencia_por_dimensao(
  p_dimensao text,
  p_tipo_recorrencia text,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limite integer DEFAULT 10
) RETURNS TABLE(rotulo text, total bigint, com_recorrencia bigint, percentual numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
  v_categoria text := CASE
    WHEN lower(p_tipo_recorrencia) LIKE 'rechamada%' THEN 'Rechamada'
    WHEN lower(p_tipo_recorrencia) LIKE 'recorrente%' THEN 'Recorrente'
    WHEN lower(p_tipo_recorrencia) LIKE 'reincid%' THEN 'Reincidente'
    ELSE p_tipo_recorrencia
  END;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente') THEN RAISE EXCEPTION 'dimensao invalida'; END IF;

  RETURN QUERY
  SELECT
    CASE p_dimensao
      WHEN 'conta' THEN COALESCE(r.conta,'Sem conta')
      WHEN 'servico' THEN COALESCE(r.servico,'Sem serviço')
      WHEN 'agente' THEN COALESCE(r.agente,'Sem agente')
    END::text,
    SUM(r.total)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem=v_categoria),0)::bigint,
    ROUND(
      COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem=v_categoria),0) * 100.0
      / NULLIF(SUM(r.total),0), 1
    )
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (p_servico IS NULL OR r.servico=p_servico)
    AND (p_agente IS NULL OR r.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
  GROUP BY 1
  ORDER BY 3 DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_detalhes_por_dimensao(
  p_dimensao text,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limite integer DEFAULT 50
) RETURNS TABLE(
  rotulo text,
  total bigint,
  humanos bigint,
  mistos bigint,
  automaticos bigint,
  ativos bigint,
  receptivos bigint,
  rechamadas bigint,
  recorrentes bigint,
  reincidentes bigint,
  tme_segundos numeric,
  tma_segundos numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente') THEN RAISE EXCEPTION 'dimensao invalida'; END IF;

  RETURN QUERY
  SELECT
    CASE p_dimensao
      WHEN 'conta' THEN COALESCE(r.conta,'Sem conta')
      WHEN 'servico' THEN COALESCE(r.servico,'Sem serviço')
      WHEN 'agente' THEN COALESCE(r.agente,'Sem agente')
    END::text,
    SUM(r.total)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo IN ('Humano','Misto')),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo='Misto'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo IN ('Automático','Notificação')),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.ativo_receptivo='Ativo'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.ativo_receptivo='Receptivo'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Rechamada'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Recorrente'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_origem='Reincidente'),0)::bigint,
    ROUND(CASE WHEN SUM(r.tme_qtd)=0 THEN NULL ELSE SUM(r.tme_soma)/SUM(r.tme_qtd) END)::numeric,
    ROUND(CASE WHEN SUM(r.tma_qtd)=0 THEN NULL ELSE SUM(r.tma_soma)/SUM(r.tma_qtd) END)::numeric
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (p_servico IS NULL OR r.servico=p_servico)
    AND (p_agente IS NULL OR r.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_heatmap(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL
) RETURNS TABLE(dia_semana text, hora text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    r.dia_semana::text,
    lpad(r.hora::text,2,'0'),
    SUM(r.total)::bigint
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
  GROUP BY r.dia_semana, r.hora
  ORDER BY r.dia_semana, r.hora;
END;
$$;

REVOKE ALL ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_evolucao_volume(timestamptz,timestamptz,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agrupado(text,timestamptz,timestamptz,integer,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_filtro_valores(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recorrencia_periodo(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recorrencia_por_dimensao(text,text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_detalhes_por_dimensao(text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_heatmap(timestamptz,timestamptz,text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_evolucao_volume(timestamptz,timestamptz,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agrupado(text,timestamptz,timestamptz,integer,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtro_valores(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_periodo(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_por_dimensao(text,text,timestamptz,timestamptz,text,text,text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_detalhes_por_dimensao(text,timestamptz,timestamptz,text,text,text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_heatmap(timestamptz,timestamptz,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
