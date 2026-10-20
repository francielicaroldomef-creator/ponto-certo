import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SUPERVISOR_PATHS, isSupervisorOnly } from "@/components/app-shell";
import { useMe } from "@/hooks/use-auth";

/** Blocks direct URL access to administrative areas for the Supervisor profile. */
function RoleGuard({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (isLoading || !me) return null;
  if (isSupervisorOnly(me.roles) && !(SUPERVISOR_PATHS as readonly string[]).some((p) => path === p || path.startsWith(`${p}/`))) {
    return <Navigate to="/painel" replace />;
  }
  return <>{children}</>;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AppShell>
      <RoleGuard>
        <Outlet />
      </RoleGuard>
    </AppShell>
  ),
});
