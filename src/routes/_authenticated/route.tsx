import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell, SUPERVISOR_PATHS, isSupervisorOnly } from "@/components/app-shell";
import { useMe } from "@/hooks/use-auth";
import { ensureDefaultSession, getQuickAccessSession } from "@/lib/quick-access";

/** Blocks direct URL access to administrative areas for the Supervisor profile. */
function RoleGuard({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (isLoading || !me) return null;

  // Master Admin (Francieli) tem acesso irrestrito
  if (me.isMasterAdmin) return <>{children}</>;

  // Se o colaborador possui módulos específicos permitidos pela Francieli
  if (me.allowedModules && me.allowedModules.length > 0) {
    const isAllowed = me.allowedModules.some((p) => path === p || path.startsWith(`${p}/`));
    if (!isAllowed) {
      const fallback = me.allowedModules[0] || "/painel";
      return <Navigate to={fallback as any} replace />;
    }
    return <>{children}</>;
  }

  // Regra padrão de supervisor-only
  if (isSupervisorOnly(me.roles) && !(SUPERVISOR_PATHS as readonly string[]).some((p) => path === p || path.startsWith(`${p}/`))) {
    return <Navigate to="/painel" replace />;
  }
  return <>{children}</>;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    let quick = getQuickAccessSession();
    if (!quick) {
      quick = ensureDefaultSession();
    }
  },
  component: () => (
    <AppShell>
      <RoleGuard>
        <Outlet />
      </RoleGuard>
    </AppShell>
  ),
});

