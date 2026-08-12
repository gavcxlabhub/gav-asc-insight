import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Repeat2,
  Building2,
  Wrench,
  Users,
  Clock,
  DatabaseZap,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { totalAtendimentosQuery } from "@/lib/analytics-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Visão Executiva", icon: LayoutDashboard, adminOnly: false },
  { to: "/recorrencia", label: "Recorrência", icon: Repeat2, adminOnly: false },
  { to: "/contas", label: "Contas / Departamentos", icon: Building2, adminOnly: false },
  { to: "/servicos", label: "Serviços", icon: Wrench, adminOnly: false },
  { to: "/agentes", label: "Agentes", icon: Users, adminOnly: false },
  { to: "/horarios", label: "Horários de Pico", icon: Clock, adminOnly: false },
  { to: "/gerenciar", label: "Gerenciar Base", icon: DatabaseZap, adminOnly: true },
  { to: "/usuarios", label: "Gerenciar Usuários", icon: ShieldCheck, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const totalQuery = useQuery(totalAtendimentosQuery());
  const temBase = (totalQuery.data ?? 0) > 0;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:flex lg:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full lg:flex",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
            GAV
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">ASC Analytics</p>
            <p className="text-[11px] text-sidebar-foreground/70">GAV Resorts</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 text-[11px] text-sidebar-foreground/60">
          Plataforma ASC · WhatsApp
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              {mobileOpen ? <Menu className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              GAV ASC Analytics
            </span>
            <Badge
              variant="outline"
              className={cn(
                "hidden gap-1.5 border-border text-xs font-medium sm:inline-flex",
                temBase ? "text-success" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  temBase ? "bg-success" : "bg-muted-foreground",
                )}
              />
              {temBase
                ? `Base carregada · ${(totalQuery.data ?? 0).toLocaleString("pt-BR")} atendimentos`
                : "Nenhuma base carregada"}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(profile?.nome ?? profile?.email ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight">
                    {profile?.nome ?? profile?.email}
                  </span>
                  <span className="block text-[11px] capitalize text-muted-foreground">
                    {profile?.role === "admin" ? "Administrador" : "Visualizador"}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5">
                <span className="block text-sm">{profile?.nome ?? "Usuário"}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut className="mr-2 size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="sr-only" />
          </button>
        ) : null}

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
