import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "visualizador";

export interface ManagedUser {
  id: string;
  nome: string | null;
  email: string;
  role: AppRole;
  ativo: boolean;
  pendente: boolean;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Acesso restrito a administradores.");
}

const listUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, ativo, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email ?? "",
      role: p.role as AppRole,
      ativo: p.ativo,
      pendente: !p.ativo,
    }));
  });

const inviteUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; email: string; role: AppRole }) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
    const role: AppRole = input.role === "admin" ? "admin" : "visualizador";
    const nome = String(input.nome ?? "").trim().slice(0, 120);
    return { nome, email, role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("convites").insert({
      email: data.email,
      nome: data.nome || null,
      role: data.role,
      convidado_por: context.userId,
    });
    return { ok: true };
  });

const setUserRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; role: AppRole }) => {
    const role: AppRole = input.role === "admin" ? "admin" : "visualizador";
    const targetUserId = String(input.targetUserId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error("Usuário inválido.");
    return { targetUserId, role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode alterar seu próprio perfil.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const setUserActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; ativo: boolean }) => {
    const targetUserId = String(input.targetUserId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error("Usuário inválido.");
    return { targetUserId, ativo: !!input.ativo };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode alterar seu próprio acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resetUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string }) => {
    const targetUserId = String(input.targetUserId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error("Usuário inválido.");
    return { targetUserId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.email) throw new Error("Usuário sem e-mail cadastrado.");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = () => listUsersFn();
export const inviteUser = (data: { nome: string; email: string; role: AppRole }) =>
  inviteUserFn({ data });
export const setUserRole = (data: { targetUserId: string; role: AppRole }) =>
  setUserRoleFn({ data });
export const setUserActive = (data: { targetUserId: string; ativo: boolean }) =>
  setUserActiveFn({ data });
export const resetUserPassword = (data: { targetUserId: string }) =>
  resetUserPasswordFn({ data });
