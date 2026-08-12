-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'visualizador');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  ativo boolean NOT NULL DEFAULT false,
  role public.app_role NOT NULL DEFAULT 'visualizador',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES (source of truth for authorization)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND ativo = true);
$$;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- New user handler: first user becomes active admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_first boolean;
  _role public.app_role;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO _is_first;
  _role := CASE WHEN _is_first THEN 'admin'::public.app_role ELSE 'visualizador'::public.app_role END;

  INSERT INTO public.profiles (id, nome, email, ativo, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    _is_first,
    _role
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep user_roles in sync when admin changes profiles.role
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, NEW.role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_role_change
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- CONVITES
CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome text,
  role public.app_role NOT NULL DEFAULT 'visualizador',
  status text NOT NULL DEFAULT 'pendente',
  convidado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convites_admin_all" ON public.convites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- IMPORTACOES
CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text,
  periodo_inicio timestamptz,
  periodo_fim timestamptz,
  total_lido integer DEFAULT 0,
  registros_novos integer DEFAULT 0,
  duplicados integer DEFAULT 0,
  invalidos integer DEFAULT 0,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "importacoes_select_ativos" ON public.importacoes FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY "importacoes_admin_write" ON public.importacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "importacoes_admin_update" ON public.importacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "importacoes_admin_delete" ON public.importacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ATENDIMENTOS
CREATE TABLE public.atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text,
  source_record_key text UNIQUE,
  agente text,
  conta text,
  servico text,
  contato text,
  telefone text,
  numero_externo text,
  canal text DEFAULT 'Whatsapp',
  data_entrada timestamptz,
  data_atendimento timestamptz,
  data_fila timestamptz,
  data_finalizacao timestamptz,
  primeira_mensagem_agente timestamptz,
  tempo_em_fila text,
  tempo_atendimento text,
  tempo_pendencia text,
  tmic text,
  tmia text,
  status text,
  tipo text,
  ativo_receptivo text,
  classificacao_origem text,
  recorrencia_origem text,
  tag text,
  prioritario text,
  qic text,
  qia text,
  protocolo_dependente text,
  atendimento_original text,
  ferramenta text DEFAULT 'ASC',
  arquivo_origem text,
  importacao_id uuid REFERENCES public.importacoes(id) ON DELETE CASCADE,
  dados_origem jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atendimentos_select_ativos" ON public.atendimentos FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY "atendimentos_admin_insert" ON public.atendimentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "atendimentos_admin_update" ON public.atendimentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "atendimentos_admin_delete" ON public.atendimentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_atendimentos_data_entrada ON public.atendimentos (data_entrada);
CREATE INDEX idx_atendimentos_conta ON public.atendimentos (conta);
CREATE INDEX idx_atendimentos_agente ON public.atendimentos (agente);
CREATE INDEX idx_atendimentos_ferramenta ON public.atendimentos (ferramenta);
CREATE INDEX idx_atendimentos_recorrencia ON public.atendimentos (recorrencia_origem);
CREATE INDEX idx_atendimentos_importacao ON public.atendimentos (importacao_id);