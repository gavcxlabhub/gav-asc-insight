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
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente') THEN RAISE EXCEPTION 'dimensao invalida'; END IF;
  RETURN QUERY EXECUTE format($f$
    SELECT
      COALESCE(%I, 'Sem %s')::text AS rotulo,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%' || $1 || '%%')::bigint AS com_recorrencia,
      ROUND(
        COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%' || $1 || '%%') * 100.0
        / NULLIF(COUNT(*), 0), 1
      ) AS percentual
    FROM public.atendimentos
    WHERE data_entrada BETWEEN $2 AND $3
      AND ($4 IS NULL OR conta = $4)
      AND ($5 IS NULL OR servico = $5)
      AND ($6 IS NULL OR agente = $6)
      AND ($7 IS NULL OR tipo = $7)
      AND ($8 IS NULL OR ativo_receptivo = $8)
      AND ($9 IS NULL OR status = $9)
    GROUP BY %I
    ORDER BY com_recorrencia DESC
    LIMIT $10
  $f$, p_dimensao, p_dimensao, p_dimensao)
  USING p_tipo_recorrencia, p_data_inicio, p_data_fim, p_conta, p_servico, p_agente, p_tipo, p_ativo_receptivo, p_status, p_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recorrencia_por_dimensao(text,text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_por_dimensao(text,text,timestamptz,timestamptz,text,text,text,text,text,text,integer) TO authenticated;

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
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente') THEN RAISE EXCEPTION 'dimensao invalida'; END IF;
  RETURN QUERY EXECUTE format($f$
    SELECT
      COALESCE(%I, 'Sem %s')::text,
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE tipo = 'Humano')::bigint,
      COUNT(*) FILTER (WHERE tipo = 'Misto')::bigint,
      COUNT(*) FILTER (WHERE tipo = 'Automático')::bigint,
      COUNT(*) FILTER (WHERE ativo_receptivo = 'Ativo')::bigint,
      COUNT(*) FILTER (WHERE ativo_receptivo = 'Receptivo')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%rechamada%%')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%recorrente%%')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%reincid%%')::bigint,
      ROUND(AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval))) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'), 1),
      ROUND(AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval))) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'), 1)
    FROM public.atendimentos
    WHERE data_entrada BETWEEN $1 AND $2
      AND ($3 IS NULL OR conta = $3)
      AND ($4 IS NULL OR servico = $4)
      AND ($5 IS NULL OR agente = $5)
      AND ($6 IS NULL OR tipo = $6)
      AND ($7 IS NULL OR ativo_receptivo = $7)
      AND ($8 IS NULL OR status = $8)
    GROUP BY %I
    ORDER BY COUNT(*) DESC
    LIMIT $9
  $f$, p_dimensao, p_dimensao, p_dimensao)
  USING p_data_inicio, p_data_fim, p_conta, p_servico, p_agente, p_tipo, p_ativo_receptivo, p_status, p_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.get_detalhes_por_dimensao(text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_detalhes_por_dimensao(text,timestamptz,timestamptz,text,text,text,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_heatmap(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL
) RETURNS TABLE(dia_semana text, hora text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT
    to_char(a.data_entrada, 'ID')::text AS dia_semana,
    to_char(a.data_entrada, 'HH24')::text AS hora,
    COUNT(*)::bigint AS total
  FROM public.atendimentos a
  WHERE a.data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR a.conta = p_conta)
    AND (p_tipo IS NULL OR a.tipo = p_tipo)
    AND (p_ativo_receptivo IS NULL OR a.ativo_receptivo = p_ativo_receptivo)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.get_heatmap(timestamptz,timestamptz,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_heatmap(timestamptz,timestamptz,text,text,text) TO authenticated;