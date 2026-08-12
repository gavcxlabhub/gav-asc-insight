import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type Profile } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STALE_TIME } from "@/lib/analytics-queries";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Gerenciar Usuários — GAV ASC Analytics" },
      {
        name: "description",
        content: "Aprovação, perfis de acesso e convites de usuários da plataforma GAV ASC.",
      },
      { property: "og:title", content: "Gerenciar Usuários — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Aprovação, perfis de acesso e convites de usuários.",
      },
    ],
  }),
  component: GerenciarUsuarios,
});

interface Convite {
  id: string;
  email: string;
  nome: string | null;
  role: AppRole;
  status: string;
  created_at: string;
}

function GerenciarUsuarios() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<AppRole>("visualizador");

  const usuarios = useQuery({
    queryKey: ["profiles"],
    staleTime: STALE_TIME,
    enabled: isAdmin,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, ativo, role, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const convites = useQuery({
    queryKey: ["convites"],
    staleTime: STALE_TIME,
    enabled: isAdmin,
    queryFn: async (): Promise<Convite[]> => {
      const { data, error } = await supabase
        .from("convites")
        .select("id, email, nome, role, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Convite[];
    },
  });

  const atualizar = useMutation({
    mutationFn: async (input: { id: string; ativo?: boolean; role?: AppRole }) => {
      const { id, ...changes } = input;
      const { error } = await supabase.from("profiles").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convidar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("convites").insert({
        email: email.trim().toLowerCase(),
        nome: nome.trim() || null,
        role,
        convidado_por: user?.id ?? null,
      });
      if (error) throw error;
      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { nome: nome.trim() || null },
        },
      });
      if (inviteError) throw inviteError;
    },
    onSuccess: () => {
      toast.success("Convite enviado por email. O acesso depende da sua aprovação.");
      setEmail("");
      setNome("");
      queryClient.invalidateQueries({ queryKey: ["convites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Gerenciar Usuários" />
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar usuários."
          icon={<ShieldCheck className="size-6" />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gerenciar Usuários"
        description="Aprove acessos, defina perfis e convide novos usuários corporativos."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuarios.data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(value) =>
                        atualizar.mutate({ id: u.id, role: value as AppRole })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="visualizador">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.ativo}
                      onCheckedChange={(checked) => atualizar.mutate({ id: u.id, ativo: checked })}
                      aria-label="Ativar usuário"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "default" : "outline"}>
                      {u.ativo ? "Aprovado" : "Aguardando aprovação"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-6">
          <form
            className="surface space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              convidar.mutate();
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="size-4 text-gold" />
              Convidar usuário
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-nome">Nome</Label>
              <Input id="conv-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-email">Email</Label>
              <Input
                id="conv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={convidar.isPending}>
              Enviar convite
            </Button>
            <p className="text-xs text-muted-foreground">
              O convidado recebe um email de acesso, mas só entra na plataforma após ser aprovado
              aqui.
            </p>
          </form>

          <div className="surface p-5">
            <p className="mb-3 text-sm font-semibold">Convites enviados</p>
            {(convites.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum convite enviado ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(convites.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.email}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {c.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
