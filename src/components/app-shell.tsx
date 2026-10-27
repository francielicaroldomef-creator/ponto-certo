import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, FileSignature, MapPin, Users, CalendarDays, UserRoundPlus, ClipboardCheck, ShieldCheck,
  FileText, AlertTriangle, BarChart3, Lock, Settings, LogOut, Menu, UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { group: "Operação", items: [
    { to: "/painel", label: "Painel geral", icon: LayoutDashboard },
    { to: "/conferencia", label: "Conferência diária", icon: ClipboardCheck },
    { to: "/coberturas", label: "Coberturas", icon: ShieldCheck },
    { to: "/efetivo", label: "Conferência do efetivo", icon: UsersRound },
  ]},
  { group: "Ponto", items: [
    { to: "/documentos", label: "Documentos de ponto", icon: FileText },
    { to: "/divergencias", label: "Divergências", icon: AlertTriangle },
  ]},
  { group: "Cadastros", items: [
    { to: "/contratos", label: "Contratos", icon: FileSignature },
    { to: "/postos", label: "Postos", icon: MapPin },
    { to: "/funcionarios", label: "Funcionários", icon: Users },
    { to: "/escalas", label: "Escalas", icon: CalendarDays },
    { to: "/diaristas", label: "Diaristas", icon: UserRoundPlus },
  ]},
  { group: "Gestão", items: [
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/fechamentos", label: "Fechamentos", icon: Lock },
    { to: "/usuarios", label: "Usuários e configurações", icon: Settings },
  ]},
] as const;

import { clearQuickAccessSession } from "@/lib/quick-access";
import { QuickAccessDialog, useTripleClick } from "@/components/quick-access-dialog";

/** Áreas autorizadas para o perfil Supervisor (as demais são exclusivas do administrador). */
export const SUPERVISOR_PATHS = ["/painel", "/conferencia", "/coberturas", "/efetivo", "/relatorios", "/fechamentos"] as const;

export function isSupervisorOnly(roles: string[]): boolean {
  return roles.includes("supervisor") && !roles.includes("admin");
}

function NavList({
  roles,
  allowedModules,
  onNavigate,
}: {
  roles: string[];
  allowedModules?: string[] | undefined;
  onNavigate?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Se o colaborador possui módulos específicos liberados pela Francieli
  const hasCustomModules = Array.isArray(allowedModules) && allowedModules.length > 0;
  const filterFn = (itTo: string) => {
    if (hasCustomModules) return allowedModules.includes(itTo);
    if (isSupervisorOnly(roles)) return (SUPERVISOR_PATHS as readonly string[]).includes(itTo as any);
    return true;
  };

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => filterFn(it.to)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{g.group}</p>
          {g.items.map((it) => {
            const active = path.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to} onClick={onNavigate}
                className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
                <it.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);

  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    clearQuickAccessSession();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const brand = (
    <div
      className="flex items-center gap-2 px-5 py-4 cursor-pointer select-none transition-opacity active:opacity-70"
      onClick={handleTripleClick}
      title="Clique 3x para Acesso Rápido"
    >
      <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm">PS</div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-sidebar-accent-foreground">Portal do Supervisor</p>
        <p className="text-[11px] text-sidebar-foreground/60">Serviços de limpeza</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/80">
      <p className="truncate font-medium text-sidebar-accent-foreground">{me?.profile?.full_name ?? me?.user.email}</p>
      <p className="truncate">
        {me?.isMasterAdmin
          ? "Administradora Master"
          : me?.roles.length
          ? me.roles.map((r) => ROLE_LABEL[r]).join(", ")
          : "Sem perfil atribuído"}
      </p>
      <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto">
          <NavList roles={me?.roles ?? []} allowedModules={me?.allowedModules} />
        </div>
        {footer}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {brand}
          <div className="flex-1 overflow-y-auto">
            <NavList roles={me?.roles ?? []} allowedModules={me?.allowedModules} onNavigate={() => setOpen(false)} />
          </div>
          {footer}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card px-4 py-2 lg:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={handleTripleClick}
              title="Clique 3x para Acesso Rápido"
            >
              <div className="grid h-7 w-7 place-items-center rounded-md bg-primary font-bold text-primary-foreground text-xs shadow-sm">PS</div>
              <span className="font-semibold text-sm">Portal do Supervisor</span>
            </div>
          </div>
        </header>
        {me && me.roles.length === 0 && (
          <div className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-warning-foreground">
            Sua conta ainda não tem perfil de acesso. Peça a um administrador para atribuir um perfil em “Usuários e configurações”.
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
