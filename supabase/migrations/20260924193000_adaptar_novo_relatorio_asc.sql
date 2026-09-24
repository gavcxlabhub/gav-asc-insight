-- Adaptação ao novo Relatório Analítico ASC (set/2026)
-- Mantém a recorrência calculada pelo sistema e o comparativo com a recorrência informada pela ASC.

ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS telefone_normalizado text,
  ADD COLUMN IF NOT EXISTS tempo_atendimento_automatico text,
  ADD COLUMN IF NOT EXISTS recorrencia_sistema text;

UPDATE public.atendimentos
SET telefone_normalizado = NULLIF(regexp_replace(coalesce(telefone,''), '\D', '', 'g'), '')
WHERE telefone_normalizado IS DISTINCT FROM NULLIF(regexp_replace(coalesce(telefone,''), '\D', '', 'g'), '');

CREATE INDEX IF NOT EXISTS idx_atendimentos_telefone_norm_data
  ON public.atendimentos (telefone_normalizado, data_entrada);

-- Atualiza a chave técnica dos registros existentes para a mesma regra usada pelo novo importador.
-- A composição evita descartar registros válidos quando o mesmo protocolo aparece mais de uma vez.
UPDATE public.atendimentos
SET source_record_key = encode(
  digest(
    lower(coalesce(trim(protocolo),'')) || '|' ||
    coalesce(telefone_normalizado,'') || '|' ||
    coalesce(to_char(data_entrada AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'') || '|' ||
    lower(coalesce(trim(conta),'')) || '|' ||
    lower(coalesce(trim(agente),'')) || '|' ||
    lower(coalesce(trim(ativo_receptivo),''))
  , 'sha256'),
  'hex'
);

-- Tipo especial usado em todos os relatórios.
-- "Automação" agrega os tipos Automático + Notificação.
CREATE OR REPLACE FUNCTION public.tipo_match(p_tipo text, v_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_tipo IS NULL
      OR (p_tipo = 'Com Humano' AND v_tipo IN ('Humano','Misto'))
      OR (p_tipo = 'Automação' AND v_tipo IN ('Automático','Notificação'))
      OR v_tipo = p_tipo;
$$;

REVOKE ALL ON FUNCTION public.tipo_match(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tipo_match(text,text) TO authenticated;

-- Recalcula a recorrência do sistema por cliente, desconsiderando repetições do mesmo protocolo
-- como um novo contato. Regras mantidas:
-- < 24h = Rechamada
-- >= 24h e < 30 dias = Reincidente
-- >= 30 e <= 90 dias = Recorrente
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

  WITH episodios AS (
    SELECT
      telefone_normalizado,
      coalesce(nullif(trim(protocolo), ''), id::text) AS episodio,
      min(data_entrada) AS data_entrada
    FROM public.atendimentos
    WHERE telefone_normalizado IS NOT NULL
      AND data_entrada IS NOT NULL
    GROUP BY telefone_normalizado, coalesce(nullif(trim(protocolo), ''), id::text)
  ),
  sequencia AS (
    SELECT
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
      telefone_normalizado,
      episodio,
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
  WHERE a.telefone_normalizado = m.telefone_normalizado
    AND coalesce(nullif(trim(a.protocolo), ''), a.id::text) = m.episodio;

  UPDATE public.atendimentos
  SET recorrencia_sistema = NULL
  WHERE telefone_normalizado IS NULL OR data_entrada IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_recorrencia_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_recorrencia_sistema() TO authenticated;

-- Backfill inicial sem depender de auth.uid() durante a migration.
WITH episodios AS (
  SELECT
    telefone_normalizado,
    coalesce(nullif(trim(protocolo), ''), id::text) AS episodio,
    min(data_entrada) AS data_entrada
  FROM public.atendimentos
  WHERE telefone_normalizado IS NOT NULL
    AND data_entrada IS NOT NULL
  GROUP BY telefone_normalizado, coalesce(nullif(trim(protocolo), ''), id::text)
),
sequencia AS (
  SELECT
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
    telefone_normalizado,
    episodio,
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
WHERE a.telefone_normalizado = m.telefone_normalizado
  AND coalesce(nullif(trim(a.protocolo), ''), a.id::text) = m.episodio;

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
    'rechamadas', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%rechamada%'),
    'recorrentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%recorrente%'),
    'reincidentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%reincid%'),
    'tme_segundos', AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval))) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tma_segundos', AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval))) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tpr_segundos', AVG(EXTRACT(EPOCH FROM (primeira_mensagem_agente - data_fila))) FILTER (
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

CREATE OR REPLACE FUNCTION public.get_kpis_comparativo(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH filtrada AS (
    SELECT *
    FROM public.atendimentos
    WHERE data_entrada BETWEEN p_data_inicio AND p_data_fim
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_servico IS NULL OR servico = p_servico)
      AND (p_agente IS NULL OR agente = p_agente)
      AND public.tipo_match(p_tipo, tipo)
      AND (p_ativo_receptivo IS NULL OR ativo_receptivo = p_ativo_receptivo)
      AND (p_status IS NULL OR status = p_status)
  )
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
    'sys_rechamadas', COUNT(DISTINCT coalesce(telefone_normalizado,'') || '|' || coalesce(nullif(trim(protocolo),''), id::text))
      FILTER (WHERE recorrencia_sistema = 'Rechamada'),
    'sys_recorrentes', COUNT(DISTINCT coalesce(telefone_normalizado,'') || '|' || coalesce(nullif(trim(protocolo),''), id::text))
      FILTER (WHERE recorrencia_sistema = 'Recorrente'),
    'sys_reincidentes', COUNT(DISTINCT coalesce(telefone_normalizado,'') || '|' || coalesce(nullif(trim(protocolo),''), id::text))
      FILTER (WHERE recorrencia_sistema = 'Reincidente'),
    'rechamadas', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%rechamada%'),
    'recorrentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%recorrente%'),
    'reincidentes', COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%reincid%'),
    'tme_segundos', AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval))) FILTER (WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tma_segundos', AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval))) FILTER (WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'),
    'tpr_segundos', AVG(EXTRACT(EPOCH FROM (primeira_mensagem_agente - data_fila))) FILTER (
      WHERE primeira_mensagem_agente IS NOT NULL
        AND data_fila IS NOT NULL
        AND primeira_mensagem_agente > data_fila
    )
  ) INTO result
  FROM filtrada;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_kpis_comparativo(timestamptz,timestamptz,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kpis_comparativo(timestamptz,timestamptz,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_agrupado_tipo(
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_conta text DEFAULT NULL,
  p_servico text DEFAULT NULL,
  p_agente text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_ativo_receptivo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_recorrencia text DEFAULT NULL
) RETURNS TABLE(rotulo text, total bigint, humanos bigint, receptivos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  WITH filtrada AS (
    SELECT *
    FROM public.atendimentos
    WHERE data_entrada BETWEEN p_data_inicio AND p_data_fim
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_servico IS NULL OR servico = p_servico)
      AND (p_agente IS NULL OR agente = p_agente)
      AND public.tipo_match(p_tipo, tipo)
      AND (p_ativo_receptivo IS NULL OR ativo_receptivo = p_ativo_receptivo)
      AND (p_status IS NULL OR status = p_status)
      AND (p_recorrencia IS NULL OR recorrencia_origem ILIKE '%' || p_recorrencia || '%')
  )
  SELECT
    grupo::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE tipo IN ('Humano','Misto'))::bigint,
    COUNT(*) FILTER (WHERE ativo_receptivo = 'Receptivo')::bigint
  FROM (
    SELECT *,
      CASE
        WHEN tipo IN ('Humano','Misto') THEN 'Com Humano'
        WHEN tipo IN ('Automático','Notificação') THEN 'Automação'
        ELSE coalesce(tipo,'Sem informação')
      END AS grupo
    FROM filtrada
  ) x
  GROUP BY grupo
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agrupado_tipo(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agrupado_tipo(timestamptz,timestamptz,text,text,text,text,text,text,text) TO authenticated;

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
    (CASE WHEN p_granularidade = 'mes'
      THEN to_char(a.data_entrada, 'YYYY-MM')
      ELSE to_char(a.data_entrada, 'YYYY-MM-DD')
    END)::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE a.tipo IN ('Humano','Misto'))::bigint,
    COUNT(*) FILTER (WHERE a.tipo IN ('Automático','Notificação'))::bigint
  FROM public.atendimentos a
  WHERE a.data_entrada BETWEEN p_data_inicio AND p_data_fim
    AND (p_conta IS NULL OR a.conta = p_conta)
    AND (p_servico IS NULL OR a.servico = p_servico)
    AND (p_agente IS NULL OR a.agente = p_agente)
    AND public.tipo_match(p_tipo, a.tipo)
    AND (p_ativo_receptivo IS NULL OR a.ativo_receptivo = p_ativo_receptivo)
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_recorrencia IS NULL OR a.recorrencia_origem ILIKE '%' || p_recorrencia || '%')
  GROUP BY 1
  ORDER BY 1;
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
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_dimensao NOT IN ('conta','servico','agente') THEN RAISE EXCEPTION 'dimensao invalida'; END IF;

  RETURN QUERY EXECUTE format($f$
    SELECT
      COALESCE(%I, 'Sem %s')::text,
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE tipo IN ('Humano','Misto'))::bigint,
      COUNT(*) FILTER (WHERE tipo = 'Misto')::bigint,
      COUNT(*) FILTER (WHERE tipo IN ('Automático','Notificação'))::bigint,
      COUNT(*) FILTER (WHERE ativo_receptivo = 'Ativo')::bigint,
      COUNT(*) FILTER (WHERE ativo_receptivo = 'Receptivo')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%rechamada%%')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%recorrente%%')::bigint,
      COUNT(*) FILTER (WHERE recorrencia_origem ILIKE '%%reincid%%')::bigint,
      ROUND(AVG(EXTRACT(EPOCH FROM (tempo_em_fila::interval))) FILTER (
        WHERE tempo_em_fila ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      ), 1),
      ROUND(AVG(EXTRACT(EPOCH FROM (tempo_atendimento::interval))) FILTER (
        WHERE tempo_atendimento ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      ), 1)
    FROM public.atendimentos
    WHERE data_entrada BETWEEN $1 AND $2
      AND ($3 IS NULL OR conta = $3)
      AND ($4 IS NULL OR servico = $4)
      AND ($5 IS NULL OR agente = $5)
      AND public.tipo_match($6, tipo)
      AND ($7 IS NULL OR ativo_receptivo = $7)
      AND ($8 IS NULL OR status = $8)
    GROUP BY %I
    ORDER BY COUNT(*) DESC
    LIMIT $9
  $f$, p_dimensao, p_dimensao, p_dimensao)
  USING p_data_inicio, p_data_fim, p_conta, p_servico, p_agente, p_tipo, p_ativo_receptivo, p_status, p_limite;
END;
$$;
