import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getQuickAccessSession } from "@/lib/quick-access";

export type Role = "admin" | "supervisor" | "conferente" | "financeiro";

export interface CurrentUser {
  user: { id: string; email?: string | undefined };
  profile: { id: string; full_name?: string | null; email?: string | null } | null;
  roles: Role[];
  allowedContracts?: string[];
  allowedModules?: string[];
  isMasterAdmin?: boolean;
  isQuickAccess?: boolean;
  has: (...want: Role[]) => boolean;
}

export function useMe() {
  return useQuery<CurrentUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      // 1. Verifica sessão de acesso rápido (clique triplo)
      const quick = getQuickAccessSession();
      if (quick) {
        const r = [quick.role];
        return {
          user: {
            id: quick.id,
            email: `${quick.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@portaldosupervisor.local`,
          },
          profile: {
            id: quick.id,
            full_name: quick.name,
            email: `${quick.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@portaldosupervisor.local`,
          },
          roles: r,
          allowedContracts: quick.allowedContracts,
          allowedModules: quick.allowedModules,
          isMasterAdmin: quick.isMasterAdmin,
          isQuickAccess: true,
          has: (...want: Role[]) => quick.isMasterAdmin || want.some((w) => r.includes(w)),
        };
      }

      // 2. Autenticação padrão via Supabase Auth
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      const r = (roles ?? []).map((x) => x.role as Role);
      return {
        user,
        profile,
        roles: r,
        has: (...want: Role[]) => r.includes("admin") || want.some((w) => r.includes(w)),
      };
    },
    staleTime: 60_000,
  });
}

export function useContracts() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["contracts", me?.allowedContracts],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("code");
      if (error) throw error;
      let list = data ?? [];
      if (me?.allowedContracts && me.allowedContracts.length > 0) {
        list = list.filter((c) => me.allowedContracts!.includes(c.id) || me.allowedContracts!.includes(c.code));
      }
      return list;
    },
  });
}

