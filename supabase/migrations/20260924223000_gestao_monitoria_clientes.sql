-- Gestão, frequência de contatos e direcionamento de monitoria.
-- Regras de Tipo:
--   Humano + Misto = atendimento humano
--   Automático = resolvido integralmente pela IA
--   Notificação = categoria separada e fora da taxa de resolução da IA

ALTER TABLE public.atendimentos_clientes_analytics
  ADD COLUMN IF NOT EXISTS servico text,
  ADD COLUMN IF NOT EXISTS agente text,
  ADD COLUMN IF NOT EXISTS ativo_receptivo text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS recorrencia_origem text;

UPDATE public.atendimentos_clientes_analytics c
SET
  servico = a.servico,
  agente = a.agente,
  ativo_receptivo = a.ativo_receptivo,
  status = a.status,
  recorrencia_origem = a.recorrencia_origem
FROM public.atendimentos a
WHERE a.id = c.id
  AND (
    c.servico IS DISTINCT FROM a.servico
    OR c.agente IS DISTINCT FROM a.agente
    OR c.ativo_receptivo IS DISTINCT FROM a.ativo_receptivo
    OR c.status IS DISTINCT FROM a.status
    OR c.recorrencia_origem IS DISTINCT FROM a.recorrencia_origem
  );

CREATE INDEX IF NOT EXISTS idx_clientes_analytics_servico
  ON public.atendimentos_clientes_analytics (servico);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_agente
  ON public.atendimentos_clientes_analytics (agente);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_ativo
  ON public.atendimentos_clientes_analytics (ativo_receptivo);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_status
  ON public.atendimentos_clientes_analytics (status);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_dia_telefone
  ON public.atendimentos_clientes_analytics (dia, telefone_normalizado);

CREATE OR REPLACE FUNCTION public.tipo_match(p_tipo text, v_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_tipo IS NULL
      OR (p_tipo = 'Com Humano' AND v_tipo IN ('Humano','Misto'))
      OR (p_tipo = 'Automação' AND v_tipo = 'Automático')
      OR v_tipo = p_tipo;
$$;

REVOKE ALL ON FUNCTION public.tipo_match(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tipo_match(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_clientes_resumo_telefones(
  p_telefones text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_telefones IS NULL OR cardinality(p_telefones)=0 THEN
    RETURN;
  END IF;

  DELETE FROM public.atendimentos_clientes_analytics
  WHERE telefone_normalizado = ANY(p_telefones);

  INSERT INTO public.atendimentos_clientes_analytics (
    id, dia, telefone_normalizado, conta, tipo, recorrencia_sistema,
    servico, agente, ativo_receptivo, status, recorrencia_origem
  )
  SELECT
    id,
    (data_entrada AT TIME ZONE 'America/Sao_Paulo')::date,
    telefone_normalizado,
    conta,
    tipo,
    recorrencia_sistema,
    servico,
    agente,
    ativo_receptivo,
    status,
    recorrencia_origem
  FROM (
    SELECT
      id, data_entrada, telefone_normalizado, conta, tipo, recorrencia_sistema,
      servico, agente, ativo_receptivo, status, recorrencia_origem,
      row_number() OVER (
        PARTITION BY telefone_normalizado, coalesce(nullif(trim(protocolo),''), id::text)
        ORDER BY data_entrada, id
      ) AS rn
    FROM public.atendimentos
    WHERE telefone_normalizado = ANY(p_telefones)
      AND data_entrada IS NOT NULL
  ) x
  WHERE rn=1;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_clientes_resumo_telefones(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_clientes_resumo_telefones(text[]) TO authenticated;

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
    'automacao', COALESCE(SUM(total) FILTER (WHERE tipo='Automático'),0),
    'com_humano', COALESCE(SUM(total) FILTER (WHERE tipo IN ('Humano','Misto')),0),
    'ativos', COALESCE(SUM(total) FILTER (WHERE ativo_receptivo='Ativo'),0),
    'receptivos', COALESCE(SUM(total) FILTER (WHERE ativo_receptivo='Receptivo'),0),
    'asc_rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Rechamada'),0),
    'asc_recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Recorrente'),0),
    'asc_reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_origem='Reincidente'),0),
    'sys_rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Rechamada'),0),
    'sys_recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Recorrente'),0),
    'sys_reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Reincidente'),0),
    'rechamadas', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Rechamada'),0),
    'recorrentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Recorrente'),0),
    'reincidentes', COALESCE(SUM(total) FILTER (WHERE recorrencia_sistema='Reincidente'),0),
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
      OR (p_tipo='Automação' AND tipo='Automático')
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
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo='Automático'),0)::bigint
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
      OR (p_recorrencia='Reincid' AND r.recorrencia_origem='Reincidente')
      OR r.recorrencia_origem=p_recorrencia
    )
  GROUP BY 1
  ORDER BY 1;
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
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Rechamada'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Recorrente'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Reincidente'),0)::bigint
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
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema=v_categoria),0)::bigint,
    ROUND(
      COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema=v_categoria),0) * 100.0
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
      OR (p_tipo='Automação' AND r.tipo='Automático')
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
    COALESCE(SUM(r.total) FILTER (WHERE r.tipo='Automático'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.ativo_receptivo='Ativo'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.ativo_receptivo='Receptivo'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Rechamada'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Recorrente'),0)::bigint,
    COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Reincidente'),0)::bigint,
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
      OR (p_tipo='Automação' AND r.tipo='Automático')
      OR r.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR r.status=p_status)
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_frequencia_contatos(
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  result jsonb;
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rec text := CASE
    WHEN p_recorrencia IS NULL THEN NULL
    WHEN lower(p_recorrencia) LIKE 'rechamada%' THEN 'Rechamada'
    WHEN lower(p_recorrencia) LIKE 'recorrente%' THEN 'Recorrente'
    WHEN lower(p_recorrencia) LIKE 'reincid%' THEN 'Reincidente'
    ELSE p_recorrencia
  END;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH base AS (
    SELECT *
    FROM public.atendimentos_clientes_analytics c
    WHERE c.dia BETWEEN v_inicio AND v_fim
      AND (p_conta IS NULL OR c.conta=p_conta)
      AND (p_servico IS NULL OR c.servico=p_servico)
      AND (p_agente IS NULL OR c.agente=p_agente)
      AND (
        p_tipo IS NULL
        OR (p_tipo='Com Humano' AND c.tipo IN ('Humano','Misto'))
        OR (p_tipo='Automação' AND c.tipo='Automático')
        OR c.tipo=p_tipo
      )
      AND (p_ativo_receptivo IS NULL OR c.ativo_receptivo=p_ativo_receptivo)
      AND (p_status IS NULL OR c.status=p_status)
      AND (v_rec IS NULL OR c.recorrencia_sistema=v_rec)
  ),
  por_cliente AS (
    SELECT telefone_normalizado, COUNT(*)::bigint AS contatos
    FROM base
    GROUP BY telefone_normalizado
  )
  SELECT jsonb_build_object(
    'clientes_unicos', COUNT(*),
    'media_contatos', COALESCE(ROUND(AVG(contatos)::numeric,2),0),
    'um_contato', COUNT(*) FILTER (WHERE contatos=1),
    'dois_contatos', COUNT(*) FILTER (WHERE contatos=2),
    'tres_contatos', COUNT(*) FILTER (WHERE contatos=3),
    'quatro_mais', COUNT(*) FILTER (WHERE contatos>=4),
    'cinco_mais', COUNT(*) FILTER (WHERE contatos>=5)
  ) INTO result
  FROM por_cliente;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_clientes_contatos(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL,
  p_limite integer DEFAULT 20
) RETURNS TABLE(
  telefone_mascarado text,
  contatos bigint,
  rechamadas bigint,
  reincidentes bigint,
  recorrentes bigint,
  servico_principal text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
  v_rec text := CASE
    WHEN p_recorrencia IS NULL THEN NULL
    WHEN lower(p_recorrencia) LIKE 'rechamada%' THEN 'Rechamada'
    WHEN lower(p_recorrencia) LIKE 'recorrente%' THEN 'Recorrente'
    WHEN lower(p_recorrencia) LIKE 'reincid%' THEN 'Reincidente'
    ELSE p_recorrencia
  END;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    ('(**) *****-' || right(c.telefone_normalizado,4))::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE c.recorrencia_sistema='Rechamada')::bigint,
    COUNT(*) FILTER (WHERE c.recorrencia_sistema='Reincidente')::bigint,
    COUNT(*) FILTER (WHERE c.recorrencia_sistema='Recorrente')::bigint,
    mode() WITHIN GROUP (ORDER BY COALESCE(c.servico,'Sem serviço'))::text
  FROM public.atendimentos_clientes_analytics c
  WHERE c.dia BETWEEN v_inicio AND v_fim
    AND (p_conta IS NULL OR c.conta=p_conta)
    AND (p_servico IS NULL OR c.servico=p_servico)
    AND (p_agente IS NULL OR c.agente=p_agente)
    AND (
      p_tipo IS NULL
      OR (p_tipo='Com Humano' AND c.tipo IN ('Humano','Misto'))
      OR (p_tipo='Automação' AND c.tipo='Automático')
      OR c.tipo=p_tipo
    )
    AND (p_ativo_receptivo IS NULL OR c.ativo_receptivo=p_ativo_receptivo)
    AND (p_status IS NULL OR c.status=p_status)
    AND (v_rec IS NULL OR c.recorrencia_sistema=v_rec)
  GROUP BY c.telefone_normalizado
  ORDER BY COUNT(*) DESC, c.telefone_normalizado
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monitoria_agentes(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_min_atendimentos integer DEFAULT 20
) RETURNS TABLE(
  agente text,
  atendimentos_humanos bigint,
  tma_segundos numeric,
  rechamadas bigint,
  pct_rechamada numeric,
  reincidentes bigint,
  pct_reincidencia numeric,
  recorrentes bigint,
  pct_recorrencia numeric,
  inatividade bigint,
  pct_inatividade numeric,
  transferidos bigint,
  pct_transferencia numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inicio date := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim date := (p_data_fim AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  WITH por_agente AS (
    SELECT
      r.agente AS nome_agente,
      COALESCE(SUM(r.total),0)::bigint AS volume,
      ROUND(CASE WHEN SUM(r.tma_qtd)=0 THEN NULL ELSE SUM(r.tma_soma)/SUM(r.tma_qtd) END)::numeric AS tma,
      COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Rechamada'),0)::bigint AS rech,
      COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Reincidente'),0)::bigint AS reinc,
      COALESCE(SUM(r.total) FILTER (WHERE r.recorrencia_sistema='Recorrente'),0)::bigint AS recorr,
      COALESCE(SUM(r.total) FILTER (WHERE r.status='Finalizado por inatividade'),0)::bigint AS inat,
      COALESCE(SUM(r.total) FILTER (WHERE r.status='Transferido'),0)::bigint AS transf
    FROM public.atendimentos_resumo_analytics r
    WHERE r.dia BETWEEN v_inicio AND v_fim
      AND r.tipo IN ('Humano','Misto')
      AND r.agente IS NOT NULL
      AND trim(r.agente)<>''
      AND (p_conta IS NULL OR r.conta=p_conta)
      AND (p_servico IS NULL OR r.servico=p_servico)
      AND (p_agente IS NULL OR r.agente=p_agente)
      AND (p_ativo_receptivo IS NULL OR r.ativo_receptivo=p_ativo_receptivo)
      AND (p_status IS NULL OR r.status=p_status)
    GROUP BY r.agente
  )
  SELECT
    p.nome_agente,
    p.volume,
    p.tma,
    p.rech,
    ROUND(CASE WHEN p.volume=0 THEN 0 ELSE p.rech*100.0/p.volume END,2),
    p.reinc,
    ROUND(CASE WHEN p.volume=0 THEN 0 ELSE p.reinc*100.0/p.volume END,2),
    p.recorr,
    ROUND(CASE WHEN p.volume=0 THEN 0 ELSE p.recorr*100.0/p.volume END,2),
    p.inat,
    ROUND(CASE WHEN p.volume=0 THEN 0 ELSE p.inat*100.0/p.volume END,2),
    p.transf,
    ROUND(CASE WHEN p.volume=0 THEN 0 ELSE p.transf*100.0/p.volume END,2)
  FROM por_agente p
  WHERE p.volume >= p_min_atendimentos
  ORDER BY p.volume DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_frequencia_contatos(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_clientes_contatos(timestamptz,timestamptz,text,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_monitoria_agentes(timestamptz,timestamptz,text,text,text,text,text,integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_frequencia_contatos(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_clientes_contatos(timestamptz,timestamptz,text,text,text,text,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monitoria_agentes(timestamptz,timestamptz,text,text,text,text,text,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
