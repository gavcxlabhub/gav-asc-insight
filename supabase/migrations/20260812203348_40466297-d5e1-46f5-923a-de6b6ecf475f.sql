-- guard helper usage: all functions require active user

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
    'humanos', COUNT(*) FILTER (WHERE tipo = 'Humano'),
    'mistos', COUNT(*) FILTER (WHERE tipo = 'Misto'),
    'automaticos', COUNT(*) FILTER (WHERE tipo = 'Automático'),
    'ativos', COUNT(*) FILTER (WHERE ativo_receptivo = 'Ativo'),
    'receptivos', COUNT(*) FILTER (WHERE ativo_receptivo = 'Receptivo'),
    'rechamadas', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%rechamada%'),
    'recorrentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%recorrente%'),
    'reincidentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%reincid%'),
    'tme_segundos', AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval))) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tma_segundos', AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval))) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tpr_segundos', AVG(EXTRACT(EPOCH FROM (primeira_mensagem_agente - data_fila))) FILTER (WHERE primeira_mensagem_agente IS NOT NULL AND data_fila IS NOT NULL AND primeira_mensagem_agente > data_fila)
  ) INTO result
  FROM public.atendimentos
  WHERE data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR conta = p_conta)
    AND (p_servico IS NULL OR servico = p_servico)
    AND (p_agente IS NULL OR agente = p_agente)
    AND (p_tipo IS NULL OR tipo = p_tipo)
    AND (p_ativo_receptivo IS NULL OR ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR status = p_status)
    AND (p_recorrencia IS NULL OR recorrencia_origem ILIKE '%' || p_recorrencia || '%');
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;

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
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT
    (CASE WHEN p_granularidade = 'mes' THEN to_char(a.data_entrada, 'YYYY-MM') ELSE to_char(a.data_entrada, 'YYYY-MM-DD') END)::text AS periodo,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE a.tipo = 'Humano')::bigint,
    COUNT(*) FILTER (WHERE a.tipo = 'Automático')::bigint
  FROM public.atendimentos a
  WHERE a.data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR a.conta = p_conta)
    AND (p_servico IS NULL OR a.servico = p_servico)
    AND (p_agente IS NULL OR a.agente = p_agente)
    AND (p_tipo IS NULL OR a.tipo = p_tipo)
    AND (p_ativo_receptivo IS NULL OR a.ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_recorrencia IS NULL OR a.recorrencia_origem ILIKE '%' || p_recorrencia || '%')
  GROUP BY 1
  ORDER BY 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_evolucao_volume(timestamptz,timestamptz,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_evolucao_volume(timestamptz,timestamptz,text,text,text,text,text,text,text,text) TO authenticated;

-- Agrupamento genérico por dimensão (conta, servico, agente, tipo, ativo_receptivo, status, hora, dia_semana, recorrencia)
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
DECLARE expr text;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  expr := CASE p_dimensao
    WHEN 'conta' THEN 'COALESCE(a.conta, ''Sem conta'')'
    WHEN 'servico' THEN 'COALESCE(a.servico, ''Sem serviço'')'
    WHEN 'agente' THEN 'COALESCE(a.agente, ''Sem agente'')'
    WHEN 'tipo' THEN 'COALESCE(a.tipo, ''Sem informação'')'
    WHEN 'ativo_receptivo' THEN 'COALESCE(a.ativo_receptivo, ''Sem informação'')'
    WHEN 'status' THEN 'COALESCE(a.status, ''Sem status'')'
    WHEN 'hora' THEN 'to_char(a.data_entrada, ''HH24'')'
    WHEN 'dia_semana' THEN 'to_char(a.data_entrada, ''ID'')'
    WHEN 'recorrencia' THEN 'CASE WHEN a.recorrencia_origem ILIKE ''%rechamada%'' THEN ''Rechamada'' WHEN a.recorrencia_origem ILIKE ''%reincid%'' THEN ''Reincidente'' WHEN a.recorrencia_origem ILIKE ''%recorrente%'' THEN ''Recorrente'' ELSE ''Sem informação'' END'
    ELSE NULL END;
  IF expr IS NULL THEN RAISE EXCEPTION 'dimensao invalida'; END IF;

  RETURN QUERY EXECUTE format($f$
    SELECT %s::text AS rotulo,
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE a.tipo = 'Humano')::bigint,
      COUNT(*) FILTER (WHERE a.ativo_receptivo = 'Receptivo')::bigint
    FROM public.atendimentos a
    WHERE a.data_entrada BETWEEN $1 AND $2
      AND ($3 IS NULL OR a.conta = $3)
      AND ($4 IS NULL OR a.servico = $4)
      AND ($5 IS NULL OR a.agente = $5)
      AND ($6 IS NULL OR a.tipo = $6)
      AND ($7 IS NULL OR a.ativo_receptivo = $7)
      AND ($8 IS NULL OR a.status = $8)
      AND ($9 IS NULL OR a.recorrencia_origem ILIKE '%%' || $9 || '%%')
    GROUP BY 1
    ORDER BY %s
    LIMIT $10
  $f$, expr, CASE WHEN p_dimensao IN ('hora','dia_semana') THEN '1 ASC' ELSE '2 DESC' END)
  USING p_data_inicio, p_data_fim, p_conta, p_servico, p_agente, p_tipo, p_ativo_receptivo, p_status, p_recorrencia, GREATEST(p_limite, 1);
END;
$$;
REVOKE ALL ON FUNCTION public.get_agrupado(text,timestamptz,timestamptz,integer,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agrupado(text,timestamptz,timestamptz,integer,text,text,text,text,text,text,text) TO authenticated;

-- Recorrência por período (barras agrupadas)
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
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT
    (CASE WHEN p_granularidade = 'mes' THEN to_char(a.data_entrada, 'YYYY-MM') ELSE to_char(a.data_entrada, 'YYYY-MM-DD') END)::text,
    COUNT(*) FILTER (WHERE a.recorrencia_origem ILIKE '%rechamada%')::bigint,
    COUNT(*) FILTER (WHERE a.recorrencia_origem ILIKE '%recorrente%')::bigint,
    COUNT(*) FILTER (WHERE a.recorrencia_origem ILIKE '%reincid%')::bigint
  FROM public.atendimentos a
  WHERE a.data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR a.conta = p_conta)
    AND (p_servico IS NULL OR a.servico = p_servico)
    AND (p_agente IS NULL OR a.agente = p_agente)
    AND (p_tipo IS NULL OR a.tipo = p_tipo)
    AND (p_ativo_receptivo IS NULL OR a.ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR a.status = p_status)
  GROUP BY 1
  ORDER BY 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_recorrencia_periodo(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_periodo(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;

-- Valores distintos para popular filtros
CREATE OR REPLACE FUNCTION public.get_filtro_valores(p_campo text)
RETURNS TABLE(valor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_campo NOT IN ('conta','servico','agente','status','tipo','ativo_receptivo') THEN
    RAISE EXCEPTION 'campo invalido';
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT %I::text AS valor FROM public.atendimentos WHERE %I IS NOT NULL AND %I <> '''' ORDER BY 1 LIMIT 500',
    p_campo, p_campo, p_campo);
END;
$$;
REVOKE ALL ON FUNCTION public.get_filtro_valores(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_filtro_valores(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_atendimentos_paginado(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_pagina integer DEFAULT 1,
  p_por_pagina integer DEFAULT 50
) RETURNS TABLE(
  id uuid, protocolo text, contato text, telefone text,
  agente text, conta text, servico text, tipo text,
  ativo_receptivo text, status text, data_entrada timestamptz,
  tempo_em_fila text, tempo_atendimento text, recorrencia_origem text,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT
    a.id, a.protocolo, a.contato,
    ('***' || RIGHT(COALESCE(a.telefone,''), 4))::text,
    a.agente, a.conta, a.servico, a.tipo,
    a.ativo_receptivo, a.status, a.data_entrada,
    a.tempo_em_fila, a.tempo_atendimento, a.recorrencia_origem,
    COUNT(*) OVER()::bigint
  FROM public.atendimentos a
  WHERE a.data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR a.conta = p_conta)
    AND (p_servico IS NULL OR a.servico = p_servico)
    AND (p_agente IS NULL OR a.agente = p_agente)
    AND (p_tipo IS NULL OR a.tipo = p_tipo)
    AND (p_ativo_receptivo IS NULL OR a.ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_recorrencia IS NULL OR a.recorrencia_origem ILIKE '%' || p_recorrencia || '%')
    AND (p_busca IS NULL OR a.protocolo ILIKE '%' || p_busca || '%'
      OR a.contato ILIKE '%' || p_busca || '%'
      OR a.agente ILIKE '%' || p_busca || '%')
  ORDER BY a.data_entrada DESC
  LIMIT LEAST(GREATEST(p_por_pagina, 1), 5000)
  OFFSET (GREATEST(p_pagina, 1) - 1) * GREATEST(p_por_pagina, 1);
END;
$$;
REVOKE ALL ON FUNCTION public.get_atendimentos_paginado(timestamptz,timestamptz,text,text,text,text,text,text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_atendimentos_paginado(timestamptz,timestamptz,text,text,text,text,text,text,text,text,integer,integer) TO authenticated;