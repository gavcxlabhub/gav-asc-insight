REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_kpis(timestamptz, timestamptz, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_agrupado(text, timestamptz, timestamptz, integer, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_evolucao_volume(timestamptz, timestamptz, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recorrencia_periodo(timestamptz, timestamptz, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recorrencia_por_dimensao(text, text, timestamptz, timestamptz, text, text, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_detalhes_por_dimensao(text, timestamptz, timestamptz, text, text, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_heatmap(timestamptz, timestamptz, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_filtro_valores(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_atendimentos_paginado(timestamptz, timestamptz, text, text, text, text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_kpis(timestamptz, timestamptz, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agrupado(text, timestamptz, timestamptz, integer, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_evolucao_volume(timestamptz, timestamptz, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_periodo(timestamptz, timestamptz, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recorrencia_por_dimensao(text, text, timestamptz, timestamptz, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_detalhes_por_dimensao(text, timestamptz, timestamptz, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_heatmap(timestamptz, timestamptz, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtro_valores(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_atendimentos_paginado(timestamptz, timestamptz, text, text, text, text, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;

CREATE POLICY "profiles_no_client_insert" ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "user_roles_no_client_insert" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "user_roles_no_client_update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "user_roles_no_client_delete" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);