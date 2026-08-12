import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, profile, isActive } = useAuth();

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">Acesso aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada, mas ainda precisa ser aprovada por um administrador do GAV ASC
            Analytics.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
