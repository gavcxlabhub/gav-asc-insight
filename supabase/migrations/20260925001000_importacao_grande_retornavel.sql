-- Importações ASC grandes: pós-processamento retomável e em lotes seguros.
-- Os atendimentos são salvos primeiro. Recorrência, clientes e resumos podem ser retomados
-- sem reimportar o arquivo caso uma chamada seja interrompida.

ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS processamento_status text NOT NULL DEFAULT 'concluido',
  ADD COLUMN IF NOT EXISTS processamento_etapa text,
  ADD COLUMN IF NOT EXISTS processamento_mensagem text,
  ADD COLUMN IF NOT EXISTS processamento_atualizado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.recorrencia_processamento_queue (
  importacao_id uuid NOT NULL,
  telefone_normalizado text NOT NULL,
  processado boolean NOT NULL DEFAULT false,
  processado_em timestamptz,
  clientes_processado boolean NOT NULL DEFAULT false,
  clientes_processado_em timestamptz,
  PRIMARY KEY (importacao_id, telefone_normalizado)
);

ALTER TABLE public.recorrencia_processamento_queue
  ADD COLUMN IF NOT EXISTS clientes_processado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clientes_processado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_recorrencia_queue_pendente
  ON public.recorrencia_processamento_queue (importacao_id, processado);

CREATE INDEX IF NOT EXISTS idx_recorrencia_queue_clientes_pendente
  ON public.recorrencia_processamento_queue (importacao_id, clientes_processado);

REVOKE ALL ON public.recorrencia_processamento_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.recorrencia_processamento_queue TO service_role;

CREATE OR REPLACE FUNCTION public.adicionar_telefones_recorrencia_queue(
  p_importacao_id uuid,
  p_telefones text[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_telefones IS NULL OR cardinality(p_telefones)=0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.recorrencia_processamento_queue (
    importacao_id,
    telefone_normalizado
  )
  SELECT p_importacao_id, t.telefone
  FROM (
    SELECT DISTINCT unnest(p_telefones) AS telefone
  ) t
  WHERE t.telefone IS NOT NULL
    AND trim(t.telefone) <> ''
  ON CONFLICT (importacao_id, telefone_normalizado) DO NOTHING;

  GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  RETURN v_inseridos;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_recorrencia_importacao_lote_fast(
  p_importacao_id uuid,
  p_limite integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telefones text[];
  v_qtd integer := 0;
  v_atualizados bigint := 0;
  v_restantes bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_limite < 1 OR p_limite > 5000 THEN
    RAISE EXCEPTION 'limite invalido';
  END IF;

  SELECT array_agg(q.telefone_normalizado)
  INTO v_telefones
  FROM (
    SELECT telefone_normalizado
    FROM public.recorrencia_processamento_queue
    WHERE importacao_id = p_importacao_id
      AND processado = false
    ORDER BY telefone_normalizado
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  ) q;

  v_qtd := COALESCE(cardinality(v_telefones), 0);

  IF v_qtd = 0 THEN
    RETURN jsonb_build_object(
      'processados', 0,
      'restantes', 0,
      'atualizados', 0
    );
  END IF;

  WITH base AS (
    SELECT
      a.id,
      a.telefone_normalizado,
      COALESCE(NULLIF(trim(a.protocolo), ''), a.id::text) AS episodio,
      a.data_entrada,
      row_number() OVER (
        PARTITION BY
          a.telefone_normalizado,
          COALESCE(NULLIF(trim(a.protocolo), ''), a.id::text)
        ORDER BY a.data_entrada, a.id
      ) AS rn
    FROM public.atendimentos a
    WHERE a.telefone_normalizado = ANY(v_telefones)
      AND a.data_entrada IS NOT NULL
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
    AND a.recorrencia_sistema IS DISTINCT FROM m.categoria;

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  UPDATE public.recorrencia_processamento_queue
  SET
    processado = true,
    processado_em = now()
  WHERE importacao_id = p_importacao_id
    AND telefone_normalizado = ANY(v_telefones);

  SELECT count(*)
  INTO v_restantes
  FROM public.recorrencia_processamento_queue
  WHERE importacao_id = p_importacao_id
    AND processado = false;

  RETURN jsonb_build_object(
    'processados', v_qtd,
    'restantes', v_restantes,
    'atualizados', v_atualizados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_clientes_importacao_lote(
  p_importacao_id uuid,
  p_limite integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telefones text[];
  v_qtd integer := 0;
  v_restantes bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_limite < 1 OR p_limite > 5000 THEN
    RAISE EXCEPTION 'limite invalido';
  END IF;

  SELECT array_agg(q.telefone_normalizado)
  INTO v_telefones
  FROM (
    SELECT telefone_normalizado
    FROM public.recorrencia_processamento_queue
    WHERE importacao_id = p_importacao_id
      AND processado = true
      AND clientes_processado = false
    ORDER BY telefone_normalizado
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  ) q;

  v_qtd := COALESCE(cardinality(v_telefones), 0);

  IF v_qtd = 0 THEN
    SELECT count(*)
    INTO v_restantes
    FROM public.recorrencia_processamento_queue
    WHERE importacao_id = p_importacao_id
      AND clientes_processado = false;

    RETURN jsonb_build_object(
      'processados', 0,
      'restantes', v_restantes
    );
  END IF;

  DELETE FROM public.atendimentos_clientes_analytics
  WHERE telefone_normalizado = ANY(v_telefones);

  INSERT INTO public.atendimentos_clientes_analytics (
    id,
    dia,
    telefone_normalizado,
    conta,
    tipo,
    recorrencia_sistema,
    servico,
    agente,
    ativo_receptivo,
    status,
    recorrencia_origem
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
      a.id,
      a.data_entrada,
      a.telefone_normalizado,
      a.conta,
      a.tipo,
      a.recorrencia_sistema,
      a.servico,
      a.agente,
      a.ativo_receptivo,
      a.status,
      a.recorrencia_origem,
      row_number() OVER (
        PARTITION BY
          a.telefone_normalizado,
          COALESCE(NULLIF(trim(a.protocolo), ''), a.id::text)
        ORDER BY a.data_entrada, a.id
      ) AS rn
    FROM public.atendimentos a
    WHERE a.telefone_normalizado = ANY(v_telefones)
      AND a.data_entrada IS NOT NULL
  ) x
  WHERE rn = 1;

  UPDATE public.recorrencia_processamento_queue
  SET
    clientes_processado = true,
    clientes_processado_em = now()
  WHERE importacao_id = p_importacao_id
    AND telefone_normalizado = ANY(v_telefones);

  SELECT count(*)
  INTO v_restantes
  FROM public.recorrencia_processamento_queue
  WHERE importacao_id = p_importacao_id
    AND clientes_processado = false;

  RETURN jsonb_build_object(
    'processados', v_qtd,
    'restantes', v_restantes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_processamento_importacoes()
RETURNS TABLE(
  importacao_id uuid,
  total_telefones bigint,
  recorrencia_concluidos bigint,
  recorrencia_pendentes bigint,
  clientes_concluidos bigint,
  clientes_pendentes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    q.importacao_id,
    count(*)::bigint,
    count(*) FILTER (WHERE q.processado)::bigint,
    count(*) FILTER (WHERE NOT q.processado)::bigint,
    count(*) FILTER (WHERE q.clientes_processado)::bigint,
    count(*) FILTER (WHERE NOT q.clientes_processado)::bigint
  FROM public.recorrencia_processamento_queue q
  GROUP BY q.importacao_id;
END;
$$;

DROP FUNCTION IF EXISTS public.recalcular_recorrencia_importacao_bucket(uuid,integer,integer);
DROP FUNCTION IF EXISTS public.processar_recorrencia_importacao_lote(uuid,integer);

REVOKE ALL ON FUNCTION public.adicionar_telefones_recorrencia_queue(uuid,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.processar_recorrencia_importacao_lote_fast(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.processar_clientes_importacao_lote(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_processamento_importacoes() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.adicionar_telefones_recorrencia_queue(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_recorrencia_importacao_lote_fast(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_clientes_importacao_lote(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_processamento_importacoes() TO authenticated;

NOTIFY pgrst, 'reload schema';
