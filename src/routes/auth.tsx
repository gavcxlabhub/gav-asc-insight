import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — GAV ASC Analytics" },
      {
        name: "description",
        content: "Acesso restrito à plataforma de análise de atendimentos da GAV Resorts.",
      },
      { property: "og:title", content: "Entrar — GAV ASC Analytics" },
      {
        property: "og:description",
        content: "Acesso restrito à plataforma de análise de atendimentos da GAV Resorts.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [modoRecuperacao, setModoRecuperacao] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique email e senha.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      "Cadastro realizado. Se você não for o primeiro usuário, aguarde a aprovação de um administrador.",
    );
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu email.");
    setModoRecuperacao(false);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-gold text-sm font-extrabold text-gold-foreground">
            GAV
          </div>
          <div>
            <p className="text-base font-semibold">ASC Analytics</p>
            <p className="text-xs text-primary-foreground/70">GAV Resorts</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Inteligência de atendimento <span className="text-gold">WhatsApp</span>
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Consolide os atendimentos exportados da plataforma ASC e acompanhe recorrência, contas,
            serviços, agentes e horários de pico em um painel executivo único.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Ambiente corporativo · acesso controlado
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-lg font-semibold">GAV ASC Analytics</p>
          </div>

          {modoRecuperacao ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Recuperar senha</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe seu email corporativo para receber o link de redefinição.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Enviar link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setModoRecuperacao(false)}
              >
                Voltar ao login
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="cadastro">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-senha">Senha</Label>
                    <Input
                      id="login-senha"
                      type="password"
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setModoRecuperacao(true)}
                  >
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="cadastro">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cad-nome">Nome</Label>
                    <Input
                      id="cad-nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cad-email">Email</Label>
                    <Input
                      id="cad-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cad-senha">Senha</Label>
                    <Input
                      id="cad-senha"
                      type="password"
                      required
                      minLength={6}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Criar conta"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O primeiro usuário cadastrado torna-se administrador. Os demais precisam de
                    aprovação de um administrador.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
