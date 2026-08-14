-- 1. Restrict direct table SELECT on atendimentos to admins only
DROP POLICY IF EXISTS atendimentos_select_ativos ON public.atendimentos;
CREATE POLICY atendimentos_select_admin ON public.atendimentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Aggregate summary RPC so non-admin active users keep the dashboard base info
CREATE OR REPLACE FUNCTION public.get_base_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'inicio', MIN(data_entrada),
    'fim', MAX(data_entrada)
  ) INTO result FROM public.atendimentos;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_base_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_base_resumo() TO authenticated;

-- 3. Internal trigger functions must not be callable by clients
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_role() FROM PUBLIC, anon, authenticated;

-- 4. Ensure no anon/public execute on the analytics definer functions
REVOKE ALL ON FUNCTION public.get_kpis(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agrupado(text,timestamptz,timestamptz,integer,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_atendimentos_paginado(timestamptz,timestamptz,text,text,text,text,text,text,text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_detalhes_por_dimensao(text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_evolucao_volume(timestamptz,timestamptz,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_filtro_valores(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_heatmap(timestamptz,timestamptz,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recorrencia_periodo(timestamptz,timestamptz,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recorrencia_por_dimensao(text,text,timestamptz,timestamptz,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;