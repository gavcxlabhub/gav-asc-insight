import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, ToggleLeft, ToggleRight, UserPlus, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

interface ManagedUser {
  id: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
  role: AppRole;
  pendente?: boolean;
}

async function listUsers(): Promise<ManagedUser[]> {
  const { data, error } = await (supabase as any).rpc("list_managed_users");
  if (error) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, nome, email, ativo, role")
      .order("created_at", { ascending: true });
    if (profileError) throw profileError;
    return (profiles ?? []) as ManagedUser[];
  }
  return (data ?? []) as ManagedUser[];
}

async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
}

async function setUserActive(userId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ativo })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://gav-asc-insight.lovable.app/auth",
  });
  if (error) throw new Error(error.message);
}

function UsuariosPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const [inviteNome, setInviteNome] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("visualizador");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [senhaModal, setSenhaModal] = useState<{ userId: string; nome: string; email: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState<string | null>(null);
  const [senhaLoading, setSenhaLoading] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: listUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      setUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed-users"] }),
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, ativo }: { userId: string; ativo: boolean }) =>
      setUserActive(userId, ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed-users"] }),
  });

  async function handleInvite() {
    setInviteMsg(null);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail.trim())
        .maybeSingle();

      if (existing) {
        setInviteMsg("Este email já está cadastrado.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(inviteEmail.trim(), {
        redirectTo: "https://gav-asc-insight.lovable.app/auth",
      });

      if (error) throw error;
      setInviteMsg("Convite enviado! O usuário receberá um email para definir a senha.");
      setInviteNome("");
      setInviteEmail("");
      setInviteRole("visualizador");
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    } catch (err) {
      setInviteMsg(`Erro: ${err instanceof Error ? err.message : "Tente novamente."}`);
    }
  }

  async function handleDefinirSenha() {
    if (!senhaModal || novaSenha.length < 6) {
      setSenhaMsg("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setSenhaLoading(true);
    setSenhaMsg(null);
    try {
      const { error } = await (supabase as any).rpc("admin_set_user_password", {
        p_user_id: senhaModal.userId,
        p_password: novaSenha,
      });
      if (error) throw error;
      setSenhaMsg("✅ Senha definida com sucesso!");
      setTimeout(() => {
        setSenhaModal(null);
        setNovaSenha("");
        setSenhaMsg(null);
      }, 1500);
    } catch {
      setSenhaMsg("⚠️ Não foi possível definir a senha automaticamente. Contate o administrador do sistema.");
    } finally {
      setSenhaLoading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
  const selectCls = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <>
      <PageHeader
        title="Gerenciar Usuários"
        description="Aprove acessos, defina perfis e convide novos usuários corporativos."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LISTA */}
        <div className="lg:col-span-2">
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium text-center">Ativo</th>
                  <th className="px-4 py-3 font-medium text-center">Situação</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isPending ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  (usersQuery.data ?? []).map((u: ManagedUser) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{u.nome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.role}
                          disabled={u.id === user?.id}
                          onChange={(e) =>
                            roleMutation.mutate({ userId: u.id, role: e.target.value as AppRole })
                          }
                          className={selectCls}
                        >
                          <option value="admin">Administrador</option>
                          <option value="visualizador">Visualizador</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          disabled={u.id === user?.id}
                          onClick={() => activeMutation.mutate({ userId: u.id, ativo: !u.ativo })}
                        >
                          {u.ativo ? (
                            <ToggleRight className="size-6 text-primary" />
                          ) : (
                            <ToggleLeft className="size-6 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.pendente
                            ? "bg-amber-500/20 text-amber-400"
                            : u.ativo
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {u.pendente ? "Aguardando" : u.ativo ? "Aprovado" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => u.email && resetPassword(u.email)}
                            title="Enviar email de redefinição de senha"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Key className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSenhaModal({ userId: u.id, nome: u.nome ?? u.email ?? "", email: u.email ?? "" });
                              setNovaSenha("");
                              setSenhaMsg(null);
                            }}
                            title="Definir nova senha diretamente"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Lock className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAINEL LATERAL */}
        <div className="space-y-4">
          <div className="surface p-5 space-y-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <UserPlus className="size-4 text-primary" />
              Convidar usuário
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  value={inviteNome}
                  onChange={(e) => setInviteNome(e.target.value)}
                  className={inputCls}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={inputCls}
                  placeholder="email@gavresorts.com.br"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Perfil</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AppRole)}
                  className={`${selectCls} w-full`}
                >
                  <option value="visualizador">Visualizador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {inviteMsg && (
                <p className={`text-xs ${inviteMsg.startsWith("Erro") ? "text-destructive" : "text-emerald-400"}`}>
                  {inviteMsg}
                </p>
              )}
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail}
                className="w-full"
              >
                Enviar convite
              </Button>
              <p className="text-xs text-muted-foreground">
                O convidado recebe um email de acesso, mas só entra na plataforma após ser aprovado aqui.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL SENHA */}
      {senhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="surface w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Definir nova senha</h3>
            <p className="text-sm text-muted-foreground">
              Usuário: <strong>{senhaModal.nome}</strong>
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className={inputCls}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            {senhaMsg && (
              <div className={`text-xs p-3 rounded-md ${
                senhaMsg.includes("✅")
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}>
                {senhaMsg}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setSenhaModal(null); setNovaSenha(""); setSenhaMsg(null); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={senhaLoading || novaSenha.length < 6}
                onClick={handleDefinirSenha}
              >
                {senhaLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
