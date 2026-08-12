import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "visualizador";

export interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
  role: AppRole;
  created_at: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoadingSession(false);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setLoadingSession(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, ativo, role, created_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const profile = profileQuery.data ?? null;

  return {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === "admin",
    isActive: !!profile?.ativo,
    loading: loadingSession || (!!userId && profileQuery.isLoading),
  };
}
