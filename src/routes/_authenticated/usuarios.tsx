import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, ToggleLeft, ToggleRight, UserPlus, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  listUsers,
  inviteUser,
  setUserRole,
  setUserActive,
  resetUserPassword,
  type ManagedUser,
  type AppRole,
} from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async ({ context }: any) => {
    if (!context?.isAdmin) throw redirect({ to: "/" });
  },
  component: UsuariosPage,
});

function UsuariosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [inviteNome, setInviteNome] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("visualizador");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  // Modal de definir senha
  const [senhaModal, setSenhaModal] = useState<{ userId: string; nome: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState<string | null>(null);
  const [senhaLoading, setSenhaLoading] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => listUsers(),
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteUser({ nome: inviteNome, email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      setInviteMsg("Convite enviado com sucesso!");
      setInviteNome("");
      setInviteEmail("");
      setInviteRole("visualizador");
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (e: Error) => setInviteMsg(`Erro: ${e.message}`),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) =>
      setUserRole({ targetUserId: userId, role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed-users"] }),
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, ativo }: { userId: string; ativo: boolean }) =>
      setUserActive({ targetUserId: userId, ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managed-users"] }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      resetUserPassword({ targetUserId: userId }),
    onSuccess: () => alert("Email de redefinição enviado!"),
    onError: (e: Error) => alert(`Erro: ${e.message}`),
  });

  async function handleDefinirSenha() {
    if (!senhaModal || !novaSenha || novaSenha.length < 6) {
      setSenhaMsg("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setSenhaLoading(true);
    setSenhaMsg(null);
    try {
      const { error } = await (await import("@/integrations/supabase/client")).supabase
        .functions.invoke("set-user-password", {
          body: { userId: senhaModal.userId, password: novaSenha },
        });
      if (error) throw error;
      setSenhaMsg("Senha definida com sucesso!");
      setTimeout(() => {
        setSenhaModal(null);
        setNovaSenha("");
        setSenhaMsg(null);
      }, 1500);
    } catch {
      // Fallback: usar admin direto via SQL não é possível no cliente
      // Instrui o admin a usar o Supabase
      setSenhaMsg("Use o painel do Supabase para redefinir a senha diretamente.");
    } finally {
      setSenhaLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
  const selectCls =
    "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <>
      <PageHeader
        title="Gerenciar Usuários"
        description="Aprove acessos, defina perfis e convide novos usuários corporativos."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LISTA DE USUÁRIOS */}
        <div className="lg:col-span-2 space-y-4">
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
                      <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
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
                          className="inline-flex"
                        >
                          {u.ativo ? (
                            <ToggleRight className="size-6 text-primary" />
                          ) : (
                            <ToggleLeft className="size-6 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.pendente
                              ? "bg-amber-500/20 text-amber-400"
                              : u.ativo
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.pendente ? "Aguardando aprovação" : u.ativo ? "Aprovado" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => resetMutation.mutate({ userId: u.id })}
                            title="Enviar email de redefinição de senha"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Key className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSenhaModal({ userId: u.id, nome: u.nome ?? u.email });
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
          {/* CONVIDAR */}
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
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="w-full"
              >
                {inviteMutation.isPending ? "Enviando..." : "Enviar convite"}
              </Button>
              <p className="text-xs text-muted-foreground">
                O convidado recebe um email de acesso, mas só entra na plataforma após ser aprovado aqui.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DEFINIR SENHA */}
      {senhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="surface w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Definir nova senha</h3>
            <p className="text-sm text-muted-foreground">
              Definindo senha para: <strong>{senhaModal.nome}</strong>
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className={inputCls}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
            {senhaMsg && (
              <p className={`text-xs ${senhaMsg.includes("sucesso") ? "text-emerald-400" : "text-amber-400"}`}>
                {senhaMsg}
              </p>
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
                {senhaLoading ? "Salvando..." : "Salvar senha"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
