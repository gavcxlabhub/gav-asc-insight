-- Indicadores da página Operacional.
-- Mantém a tabela bruta como fonte de verdade e usa estruturas analíticas leves.

ALTER TABLE public.atendimentos_resumo_analytics
  ADD COLUMN IF NOT EXISTS qic_soma double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qic_qtd bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qia_soma double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qia_qtd bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alta_interacao bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.atendimentos_clientes_analytics (
  id uuid PRIMARY KEY,
  dia date NOT NULL,
  telefone_normalizado text NOT NULL,
  conta text,
  tipo text,
  recorrencia_sistema text
);

REVOKE ALL ON public.atendimentos_clientes_analytics FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.atendimentos_clientes_analytics TO service_role;

CREATE INDEX IF NOT EXISTS idx_clientes_analytics_dia
  ON public.atendimentos_clientes_analytics (dia);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_telefone
  ON public.atendimentos_clientes_analytics (telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_conta
  ON public.atendimentos_clientes_analytics (conta);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_tipo
  ON public.atendimentos_clientes_analytics (tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_analytics_rec
  ON public.atendimentos_clientes_analytics (recorrencia_sistema);

TRUNCATE public.atendimentos_resumo_analytics;

INSERT INTO public.atendimentos_resumo_analytics (
  dia, hora, dia_semana,
  conta, servico, agente, tipo, ativo_receptivo, status,
  recorrencia_origem, recorrencia_sistema,
  total, tme_soma, tme_qtd, tma_soma, tma_qtd, tpr_soma, tpr_qtd,
  qic_soma, qic_qtd, qia_soma, qia_qtd, alta_interacao
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
  count(*) FILTER (
    WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
  )::bigint,
  coalesce(sum(CASE
    WHEN tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
    THEN extract(epoch from tempo_atendimento::interval)
    ELSE 0 END),0)::double precision,
  count(*) FILTER (
    WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
  )::bigint,
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
  )::bigint,
  coalesce(sum(CASE
    WHEN qic ~ '^[0-9]+([.,][0-9]+)?$'
    THEN replace(qic,',','.')::double precision
    ELSE 0 END),0)::double precision,
  count(*) FILTER (
    WHERE qic ~ '^[0-9]+([.,][0-9]+)?$'
  )::bigint,
  coalesce(sum(CASE
    WHEN qia ~ '^[0-9]+([.,][0-9]+)?$'
    THEN replace(qia,',','.')::double precision
    ELSE 0 END),0)::double precision,
  count(*) FILTER (
    WHERE qia ~ '^[0-9]+([.,][0-9]+)?$'
  )::bigint,
  count(*) FILTER (
    WHERE qic ~ '^[0-9]+([.,][0-9]+)?$'
      AND replace(qic,',','.')::double precision >= 5
  )::bigint
FROM public.atendimentos
WHERE data_entrada IS NOT NULL
GROUP BY
  1,2,3,
  conta, servico, agente, tipo, ativo_receptivo, status,
  recorrencia_origem, recorrencia_sistema;

ANALYZE public.atendimentos_resumo_analytics;

TRUNCATE public.atendimentos_clientes_analytics;

INSERT INTO public.atendimentos_clientes_analytics (
  id, dia, telefone_normalizado, conta, tipo, recorrencia_sistema
)
SELECT
  id,
  (data_entrada AT TIME ZONE 'America/Sao_Paulo')::date,
  telefone_normalizado,
  conta,
  tipo,
  recorrencia_sistema
FROM (
  SELECT
    id,
    data_entrada,
    telefone_normalizado,
    conta,
    tipo,
    recorrencia_sistema,
    row_number() OVER (
      PARTITION BY
        telefone_normalizado,
        coalesce(nullif(trim(protocolo),''), id::text)
      ORDER BY data_entrada, id
    ) AS rn
  FROM public.atendimentos
  WHERE telefone_normalizado IS NOT NULL
    AND data_entrada IS NOT NULL
) x
WHERE rn=1;

ANALYZE public.atendimentos_clientes_analytics;

CREATE OR REPLACE FUNCTION public.refresh_atendimentos_resumo(
  p_inicio date,
  p_fim date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public AS $$
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
    total, tme_soma, tme_qtd, tma_soma, tma_qtd, tpr_soma, tpr_qtd,
    qic_soma, qic_qtd, qia_soma, qia_qtd, alta_interacao
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
    count(*) FILTER (
      WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
    )::bigint,
    coalesce(sum(CASE
      WHEN tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      THEN extract(epoch from tempo_atendimento::interval)
      ELSE 0 END),0)::double precision,
    count(*) FILTER (
      WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
    )::bigint,
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
    )::bigint,
    coalesce(sum(CASE
      WHEN qic ~ '^[0-9]+([.,][0-9]+)?$'
      THEN replace(qic,',','.')::double precision
      ELSE 0 END),0)::double precision,
    count(*) FILTER (
      WHERE qic ~ '^[0-9]+([.,][0-9]+)?$'
    )::bigint,
    coalesce(sum(CASE
      WHEN qia ~ '^[0-9]+([.,][0-9]+)?$'
      THEN replace(qia,',','.')::double precision
      ELSE 0 END),0)::double precision,
    count(*) FILTER (
      WHERE qia ~ '^[0-9]+([.,][0-9]+)?$'
    )::bigint,
    count(*) FILTER (
      WHERE qic ~ '^[0-9]+([.,][0-9]+)?$'
        AND replace(qic,',','.')::double precision >= 5
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
    id, dia, telefone_normalizado, conta, tipo, recorrencia_sistema
  )
  SELECT
    id,
    (data_entrada AT TIME ZONE 'America/Sao_Paulo')::date,
    telefone_normalizado,
    conta,
    tipo,
    recorrencia_sistema
  FROM (
    SELECT
      id,
      data_entrada,
      telefone_normalizado,
      conta,
      tipo,
      recorrencia_sistema,
      row_number() OVER (
        PARTITION BY
          telefone_normalizado,
          coalesce(nullif(trim(protocolo),''), id::text)
        ORDER BY data_entrada, id
      ) AS rn
    FROM public.atendimentos
    WHERE telefone_normalizado = ANY(p_telefones)
      AND data_entrada IS NOT NULL
  ) x
  WHERE rn=1;
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
        OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
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
        OR (p_tipo='Automação' AND c.tipo IN ('Automático','Notificação'))
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
      OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
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
        OR (p_tipo='Automação' AND r.tipo IN ('Automático','Notificação'))
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
      COALESCE(SUM(r.total) FILTER (
        WHERE r.status='Finalizado por inatividade'
      ),0)::bigint AS qtd_inatividade
    FROM base r
    GROUP BY r.agente
  ),
  totais AS (
    SELECT SUM(pa.qtd_total)::numeric AS total_equipe
    FROM por_agente pa
  )
  SELECT
    pa.nome_agente,
    pa.qtd_total,
    ROUND(CASE
      WHEN t.total_equipe=0 THEN 0
      ELSE pa.qtd_total*100.0/t.total_equipe
    END,2),
    ROUND(CASE
      WHEN pa.qtd_tpr=0 THEN NULL
      ELSE pa.soma_tpr/pa.qtd_tpr
    END)::numeric,
    ROUND(CASE
      WHEN pa.qtd_tma=0 THEN NULL
      ELSE pa.soma_tma/pa.qtd_tma
    END)::numeric,
    ROUND(CASE
      WHEN pa.qtd_total=0 THEN 0
      ELSE pa.qtd_inatividade*100.0/pa.qtd_total
    END,2)
  FROM por_agente pa
  CROSS JOIN totais t
  ORDER BY pa.qtd_total DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_clientes_resumo_telefones(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_indicadores_status(timestamptz,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fcr(timestamptz,timestamptz,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_interacoes(timestamptz,timestamptz,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_concentracao_agentes(timestamptz,timestamptz,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.refresh_clientes_resumo_telefones(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_indicadores_status(timestamptz,timestamptz,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fcr(timestamptz,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_interacoes(timestamptz,timestamptz,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_concentracao_agentes(timestamptz,timestamptz,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
