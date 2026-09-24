-- Alinha filtros de Tipo em todas as visões:
-- Automação = somente Automático; Notificação permanece separada.

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
      WHEN 'recorrencia' THEN COALESCE(r.recorrencia_sistema,'Sem informação')
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
      OR (p_tipo='Automação' AND r.tipo='Automático')
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
    AND (
      p_recorrencia IS NULL
      OR (p_recorrencia='Reincid' AND r.recorrencia_sistema='Reincidente')
      OR r.recorrencia_sistema=p_recorrencia
    )
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
      OR (p_tipo='Automação' AND r.tipo='Automático')
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
  GROUP BY r.dia_semana, r.hora
  ORDER BY r.dia_semana, r.hora;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_indicadores_status(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  result jsonb;
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH base AS (
    SELECT *
    FROM public.atendimentos_resumo_analytics r
    WHERE r.dia BETWEEN v_inicio AND v_fim
      AND (p_conta IS NULL OR r.conta=p_conta)
      AND (p_servico IS NULL OR r.servico=p_servico)
      AND (p_agente IS NULL OR r.agente=p_agente)
      AND (
        p_tipo IS NULL
        OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
        OR (p_tipo='Automação' AND r.tipo='Automático')
        OR r.tipo=p_tipo
      )
      AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
  ),
  agg AS (
    SELECT
      COALESCE(SUM(total),0)::bigint AS total,
      COALESCE(SUM(total) FILTER (WHERE status='Finalizado'),0)::bigint AS finalizados,
      COALESCE(SUM(total) FILTER (WHERE status='Finalizado por inatividade'),0)::bigint AS finalizados_inatividade,
      COALESCE(SUM(total) FILTER (WHERE status='Transferido'),0)::bigint AS transferidos,
      COALESCE(SUM(total) FILTER (WHERE lower(coalesce(status,''))='em atendimento'),0)::bigint AS em_atendimento,
      COALESCE(SUM(total) FILTER (WHERE lower(coalesce(status,'')) LIKE 'aguardando%'),0)::bigint AS aguardando
    FROM base
  )
  SELECT jsonb_build_object(
    'total', total,
    'finalizados', finalizados,
    'finalizados_inatividade', finalizados_inatividade,
    'transferidos', transferidos,
    'em_atendimento', em_atendimento,
    'aguardando', aguardando,
    'pct_inatividade', CASE WHEN total=0 THEN 0 ELSE finalizados_inatividade*100.0/total END,
    'pct_transferencia', CASE WHEN total=0 THEN 0 ELSE transferidos*100.0/total END,
    'pct_finalizados', CASE WHEN total=0 THEN 0 ELSE finalizados*100.0/total END
  ) INTO result FROM agg;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fcr(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_tipo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  result jsonb;
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH base AS (
    SELECT *
    FROM public.atendimentos_clientes_analytics c
    WHERE c.dia BETWEEN v_inicio AND v_fim
      AND (p_conta IS NULL OR c.conta=p_conta)
      AND (
        p_tipo IS NULL
        OR (p_tipo='Com Humano' AND c.tipo IN ('Humano','Misto'))
        OR (p_tipo='Automação' AND c.tipo='Automático')
        OR c.tipo=p_tipo
      )
  ),
  agg AS (
    SELECT
      COUNT(DISTINCT telefone_normalizado)::bigint AS total_clientes,
      COUNT(DISTINCT telefone_normalizado)
        FILTER (WHERE recorrencia_sistema='Rechamada')::bigint AS retornaram_24h
    FROM base
  )
  SELECT jsonb_build_object(
    'total_clientes', total_clientes,
    'retornaram_24h', retornaram_24h,
    'resolvidos_primeiro_contato', GREATEST(total_clientes-retornaram_24h,0),
    'fcr_percentual',
      CASE WHEN total_clientes=0 THEN 0
           ELSE GREATEST(total_clientes-retornaram_24h,0)*100.0/total_clientes END
  ) INTO result FROM agg;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_interacoes(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  result jsonb;
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(total),0),
    'com_qic', COALESCE(SUM(qic_qtd),0),
    'qic_medio',
      CASE WHEN COALESCE(SUM(qic_qtd),0)=0 THEN 0
           ELSE ROUND((SUM(qic_soma)/SUM(qic_qtd))::numeric,2) END,
    'qia_medio',
      CASE WHEN COALESCE(SUM(qia_qtd),0)=0 THEN 0
           ELSE ROUND((SUM(qia_soma)/SUM(qia_qtd))::numeric,2) END,
    'alta_interacao', COALESCE(SUM(alta_interacao),0)
  ) INTO result
  FROM public.atendimentos_resumo_analytics r
  WHERE r.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR r.conta=p_conta)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND r.tipo='Automático')
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo);

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_concentracao_agentes(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_tipo text DEFAULT NULL
) RETURNS TABLE(
  agente text,
  total bigint,
  percentual_volume numeric,
  tpr_segundos numeric,
  tma_segundos numeric,
  pct_inatividade numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM public.atendimentos_resumo_analytics r
    WHERE r.dia BETWEEN v_inicio AND v_fim
      AND r.agente IS NOT NULL
      AND trim(r.agente)<>''
      AND (p_conta IS NULL OR r.conta=p_conta)
      AND (
        p_tipo IS NULL
        OR (p_tipo='Com Humano' AND r.tipo IN ('Humano','Misto'))
        OR (p_tipo='Automação' AND r.tipo='Automático')
        OR r.tipo=p_tipo
      )
  ),
  por_agente AS (
    SELECT
      r.agente AS nome_agente,
      SUM(r.total)::bigint AS qtd_total,
      SUM(r.tpr_soma)::double precision AS soma_tpr,
      SUM(r.tpr_qtd)::bigint AS qtd_tpr,
      SUM(r.tma_soma)::double precision AS soma_tma,
      SUM(r.tma_qtd)::bigint AS qtd_tma,
      COALESCE(SUM(r.total) FILTER (WHERE r.status='Finalizado por inatividade'),0)::bigint AS qtd_inatividade
    FROM base r
    GROUP BY r.agente
  ),
  totais AS (
    SELECT SUM(pa.qtd_total)::numeric AS total_equipe FROM por_agente pa
  )
  SELECT
    pa.nome_agente,
    pa.qtd_total,
    ROUND(CASE WHEN t.total_equipe=0 THEN 0 ELSE pa.qtd_total*100.0/t.total_equipe END,2),
    ROUND(CASE WHEN pa.qtd_tpr=0 THEN NULL ELSE pa.soma_tpr/pa.qtd_tpr END)::numeric,
    ROUND(CASE WHEN pa.qtd_tma=0 THEN NULL ELSE pa.soma_tma/pa.qtd_tma END)::numeric,
    ROUND(CASE WHEN pa.qtd_total=0 THEN 0 ELSE pa.qtd_inatividade*100.0/pa.qtd_total END,2)
  FROM por_agente pa
  CROSS JOIN totais t
  ORDER BY pa.qtd_total DESC
  LIMIT 100;
END;
$$;

NOTIFY pgrst, 'reload schema';
