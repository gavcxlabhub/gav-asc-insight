-- Evita COUNT(*) sobre a tabela pesada de atendimentos.
-- Usa o histórico de importações concluídas, que já representa os registros únicos gravados.

CREATE OR REPLACE FUNCTION public.get_base_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(i.registros_novos), 0),
    'inicio', MIN(i.periodo_inicio),
    'fim', MAX(i.periodo_fim)
  )
  INTO result
  FROM public.importacoes i
  WHERE COALESCE(i.processamento_status, 'concluido') = 'concluido';

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_base_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_base_resumo() TO authenticated;

NOTIFY pgrst, 'reload schema';
