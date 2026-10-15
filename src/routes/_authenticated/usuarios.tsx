import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/data";
import { ROLE_LABEL, fmtDateTime } from "@/lib/format";
import { useContracts, useMe, type Role } from "@/hooks/use-auth";
import { DataTable, PageHeader } from "@/components/ui-kit";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários e configurações — Portal do Supervisor" }, { name: "description", content: "Perfis de acesso, supervisores por contrato e auditoria." }] }),
  component: Usuarios,
});

const ROLES: Role[] = ["admin", "supervisor", "conferente", "financeiro"];

function Usuarios() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.has("admin");
  const { data: contracts } = useContracts();
  const { data: users } = useQuery({
    queryKey: ["users"], enabled: !!isAdmin,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role) }));
    },
  });
  const { data: audit } = useQuery({
    queryKey: ["audit"], enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  const nameOf = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? users?.find((u) => u.id === id)?.email ?? "—";

  const toggle = async (uid: string, role: Role, on: boolean) => {
    if (!on && role === "admin" && uid === me?.user.id) return toast.error("Você não pode remover seu próprio perfil de administrador.");
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: uid, role })
      : await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) toast.error(errMsg(error)); else { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["me"] }); }
  };
  const setSupervisor = async (cid: string, uid: string) => {
    const { error } = await supabase.from("contracts").update({ supervisor_id: uid === "none" ? null : uid }).eq("id", cid);
    if (error) toast.error(errMsg(error)); else { toast.success("Supervisor atualizado."); qc.invalidateQueries({ queryKey: ["contracts"] }); }
  };

  if (!isAdmin) return <div><PageHeader title="Usuários e configurações" description="Apenas administradores acessam esta tela." /></div>;
  const supervisors = (users ?? []).filter((u) => u.roles.includes("supervisor"));

  return (
    <div>
      <PageHeader title="Usuários e configurações" description="Novos usuários se cadastram pela tela de login; aqui você atribui perfis e contratos." />
      <Tabs defaultValue="users">
        <TabsList className="mb-4"><TabsTrigger value="users">Usuários</TabsTrigger><TabsTrigger value="contracts">Supervisores por contrato</TabsTrigger><TabsTrigger value="audit">Auditoria</TabsTrigger></TabsList>
        <TabsContent value="users">
          <DataTable rows={users ?? []} rowKey={(u: any) => u.id} search={(u: any) => `${u.full_name} ${u.email}`}
            cols={[
              { header: "Nome", cell: (u: any) => u.full_name ?? "—" },
              { header: "E-mail", cell: (u: any) => u.email },
              ...ROLES.map((r) => ({ header: ROLE_LABEL[r]!, cell: (u: any) => <Checkbox aria-label={`${ROLE_LABEL[r]} para ${u.email}`} checked={u.roles.includes(r)} onCheckedChange={(v) => toggle(u.id, r, !!v)} /> })),
            ]} />
        </TabsContent>
        <TabsContent value="contracts">
          <DataTable rows={contracts ?? []} rowKey={(c: any) => c.id}
            cols={[
              { header: "Contrato", cell: (c: any) => `${c.code} — ${c.name}` },
              { header: "Supervisor responsável", cell: (c: any) => (
                <Select value={c.supervisor_id ?? "none"} onValueChange={(v) => setSupervisor(c.id, v)}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem supervisor</SelectItem>
                    {supervisors.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) },
            ]} empty="Nenhum contrato." />
          {supervisors.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Marque o perfil Supervisor em algum usuário para poder atribuí-lo.</p>}
        </TabsContent>
        <TabsContent value="audit">
          <DataTable rows={audit ?? []} rowKey={(a: any) => String(a.id)} search={(a: any) => `${a.table_name} ${a.action} ${a.reason ?? ""}`}
            cols={[
              { header: "Quando", cell: (a: any) => fmtDateTime(a.created_at) },
              { header: "Usuário", cell: (a: any) => nameOf(a.user_id) },
              { header: "Tabela", cell: (a: any) => a.table_name },
              { header: "Ação", cell: (a: any) => a.action },
              { header: "Motivo", cell: (a: any) => a.reason ?? "—" },
            ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
