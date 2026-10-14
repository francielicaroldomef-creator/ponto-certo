import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "supervisor" | "conferente" | "financeiro";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
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
        has: (...want: Role[]) => want.some((w) => r.includes(w)),
      };
    },
    staleTime: 60_000,
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });
}
