import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/data";
import { ROLE_LABEL, fmtDateTime } from "@/lib/format";
import { useContracts, useMe, type Role } from "@/hooks/use-auth";
import { useState } from "react";
import { Plus, Pencil, Trash2, Key, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { DataTable, Field, PageHeader, Pill } from "@/components/ui-kit";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AVAILABLE_MODULES,
  getQuickCredentials,
  saveQuickCredential,
  deleteQuickCredential,
  type QuickAccessCredential,
  MASTER_PASSWORD,
} from "@/lib/quick-access";

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
    if (!on && role === "admin" && uid === me?.user.id) { toast.error("Você não pode remover seu próprio perfil de administrador."); return; }
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: uid, role })
      : await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) toast.error(errMsg(error)); else { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["me"] }); }
  };
  const setSupervisor = async (cid: string, uid: string) => {
    const { error } = await supabase.from("contracts").update({ supervisor_id: uid === "none" ? null : uid }).eq("id", cid);
    if (error) toast.error(errMsg(error)); else { toast.success("Supervisor atualizado."); qc.invalidateQueries({ queryKey: ["contracts"] }); }
  };

  const { data: quickCreds, refetch: refetchQuickCreds } = useQuery({
    queryKey: ["quick-credentials"],
    queryFn: getQuickCredentials,
    enabled: !!isAdmin,
  });

  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [credName, setCredName] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [credRole, setCredRole] = useState<Role>("supervisor");
  const [credContracts, setCredContracts] = useState<string[]>([]);
  const [credModules, setCredModules] = useState<string[]>([]);
  const [credActive, setCredActive] = useState(true);
  const [savingCred, setSavingCred] = useState(false);

  const openNewCred = () => {
    setEditingCredId(null);
    setCredName("");
    setCredPassword("");
    setShowCredPassword(false);
    setCredRole("supervisor");
    setCredContracts([]);
    setCredModules(["/painel", "/conferencia", "/coberturas", "/efetivo"]);
    setCredActive(true);
    setCredDialogOpen(true);
  };

  const openEditCred = (cred: QuickAccessCredential) => {
    setEditingCredId(cred.id);
    setCredName(cred.name);
    setCredPassword(cred.access_key);
    setShowCredPassword(false);
    setCredRole(cred.role);
    setCredContracts(cred.allowed_contracts || []);
    setCredModules(cred.allowed_modules || []);
    setCredActive(cred.active);
    setCredDialogOpen(true);
  };

  const saveCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credName.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }
    if (!credPassword.trim() || credPassword.trim().length < 4) {
      toast.error("Informe uma senha com no mínimo 4 caracteres.");
      return;
    }
    if (credModules.length === 0) {
      toast.error("Selecione pelo menos uma tela permitida.");
      return;
    }

    setSavingCred(true);
    try {
      await saveQuickCredential({
        id: editingCredId || undefined,
        name: credName,
        access_key: credPassword,
        role: credRole,
        allowed_contracts: credContracts,
        allowed_modules: credModules,
        active: credActive,
      });
      toast.success(editingCredId ? "Acesso atualizado com sucesso." : "Novo acesso criado com sucesso.");
      setCredDialogOpen(false);
      refetchQuickCreds();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingCred(false);
    }
  };

  const deleteCred = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente remover o acesso de "${name}"?`)) {
      try {
        await deleteQuickCredential(id);
        toast.success("Acesso removido.");
        refetchQuickCreds();
      } catch (err) {
        toast.error(errMsg(err));
      }
    }
  };

  const toggleCredActive = async (cred: QuickAccessCredential) => {
    try {
      await saveQuickCredential({
        ...cred,
        active: !cred.active,
      });
      toast.success(cred.active ? `Acesso de "${cred.name}" inativado.` : `Acesso de "${cred.name}" ativado.`);
      refetchQuickCreds();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (!isAdmin) return <div><PageHeader title="Usuários e configurações" description="Apenas administradores acessam esta tela." /></div>;
  const supervisors = (users ?? []).filter((u) => u.roles.includes("supervisor"));

  return (
    <div>
      <PageHeader title="Usuários e configurações" description="Novos usuários se cadastram pela tela de login ou pelo clique triplo com senhas individuais." />
      <Tabs defaultValue="quick_access">
        <TabsList className="mb-4">
          <TabsTrigger value="quick_access">Acessos Rápidos e Senhas</TabsTrigger>
          <TabsTrigger value="users">Usuários Supabase</TabsTrigger>
          <TabsTrigger value="contracts">Supervisores por contrato</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Aba de Acessos Rápidos por Senha (Clique Triplo) */}
        <TabsContent value="quick_access">
          <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold">Acesso Master Ativo: <span className="font-mono text-primary">{MASTER_PASSWORD}</span></h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Qualquer pessoa que digitar esta senha master no clique triplo terá controle total (Super Administrador).
                Abaixo, crie senhas individuais para colaboradores com módulos e contratos restritos.
              </p>
            </div>
            <Button onClick={openNewCred}>
              <Plus className="mr-2 h-4 w-4" /> Novo Acesso Rápido
            </Button>
          </div>

          <DataTable
            rows={quickCreds ?? []}
            rowKey={(c: QuickAccessCredential) => c.id}
            search={(c: QuickAccessCredential) => `${c.name} ${c.role}`}
            empty="Nenhum acesso rápido individual cadastrado ainda. Clique em 'Novo Acesso Rápido'."
            cols={[
              {
                header: "Colaborador",
                cell: (c: QuickAccessCredential) => (
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {c.id.slice(0, 8)}</p>
                  </div>
                ),
              },
              {
                header: "Perfil Base",
                cell: (c: QuickAccessCredential) => (
                  <Pill tone={c.role === "admin" ? "danger" : c.role === "financeiro" ? "warning" : "info"}>
                    {ROLE_LABEL[c.role]}
                  </Pill>
                ),
              },
              {
                header: "Contratos Permitidos",
                cell: (c: QuickAccessCredential) => {
                  if (!c.allowed_contracts || c.allowed_contracts.length === 0) {
                    return <span className="text-xs text-muted-foreground font-medium">Todos os contratos</span>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {c.allowed_contracts.map((cid) => {
                        const ct = contracts?.find((x) => x.id === cid || x.code === cid);
                        return (
                          <span key={cid} className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                            {ct?.code ?? cid}
                          </span>
                        );
                      })}
                    </div>
                  );
                },
              },
              {
                header: "Módulos / Telas",
                cell: (c: QuickAccessCredential) => {
                  const mods = c.allowed_modules || [];
                  if (mods.length === 0) return <span className="text-xs text-muted-foreground">Nenhum</span>;
                  const labels = mods.map((p) => AVAILABLE_MODULES.find((m) => m.path === p)?.label || p);
                  return (
                    <div className="text-xs text-muted-foreground max-w-xs truncate" title={labels.join(", ")}>
                      {labels.slice(0, 3).join(", ")}
                      {labels.length > 3 && <span className="text-primary font-medium"> (+{labels.length - 3})</span>}
                    </div>
                  );
                },
              },
              {
                header: "Senha",
                cell: (c: QuickAccessCredential) => (
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                    {c.access_key}
                  </span>
                ),
              },
              {
                header: "Situação",
                cell: (c: QuickAccessCredential) => (
                  <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => toggleCredActive(c)}>
                    <Pill tone={c.active ? "success" : "neutral"}>
                      {c.active ? "Ativo" : "Inativo"}
                    </Pill>
                  </Button>
                ),
              },
              {
                header: "Ações",
                cell: (c: QuickAccessCredential) => (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEditCred(c)} title="Editar acesso">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-destructive hover:bg-destructive/10" onClick={() => deleteCred(c.id, c.name)} title="Excluir acesso">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>

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

      {/* Modal de Criação / Edição de Acesso Rápido */}
      <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCredId ? "Editar Acesso Rápido" : "Novo Acesso Rápido"}</DialogTitle>
            <DialogDescription>
              Defina a senha e quais telas e contratos este colaborador poderá acessar via clique triplo na logo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveCred} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome completo do colaborador">
                <Input
                  value={credName}
                  onChange={(e) => setCredName(e.target.value)}
                  placeholder="Ex: Carlos - Supervisor"
                  required
                />
              </Field>

              <Field label="Senha individual de acesso">
                <div className="relative">
                  <Input
                    type={showCredPassword ? "text" : "password"}
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="Ex: carlos123"
                    className="pr-10 font-mono"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCredPassword(!showCredPassword)}
                    tabIndex={-1}
                  >
                    {showCredPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Perfil Base (Define permissões e regras)">
                <Select value={credRole} onValueChange={(v) => setCredRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor (Operacional / Postos)</SelectItem>
                    <SelectItem value="conferente">Conferente (Conferência / Presenças)</SelectItem>
                    <SelectItem value="financeiro">Financeiro (Valores / Faturamento)</SelectItem>
                    <SelectItem value="admin">Administrador (Controle irrestrito)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Situação do Acesso">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="cred-active"
                    checked={credActive}
                    onCheckedChange={(v) => setCredActive(!!v)}
                  />
                  <label htmlFor="cred-active" className="text-sm font-medium cursor-pointer">
                    Acesso ativo (pode entrar no sistema)
                  </label>
                </div>
              </Field>
            </div>

            {/* Contratos Permitidos */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Contratos Permitidos</label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setCredContracts([])}
                >
                  Liberar todos os contratos
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se nenhum contrato for marcado, o colaborador terá acesso a todos os contratos cadastrados.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto rounded-md border p-2 bg-muted/10">
                {(contracts ?? []).map((c) => {
                  const checked = credContracts.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(on) => {
                          if (on) setCredContracts([...credContracts, c.id]);
                          else setCredContracts(credContracts.filter((x) => x !== c.id));
                        }}
                      />
                      <span className="font-mono font-medium">{c.code}</span> — <span className="truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Telas / Módulos Liberados */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Telas e Módulos Liberados</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setCredModules(AVAILABLE_MODULES.map((m) => m.path))}
                  >
                    Marcar todas
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setCredModules([])}
                  >
                    Desmarcar todas
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto rounded-md border p-2 bg-muted/10">
                {AVAILABLE_MODULES.map((m) => {
                  const checked = credModules.includes(m.path);
                  return (
                    <label key={m.path} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(on) => {
                          if (on) setCredModules([...credModules, m.path]);
                          else setCredModules(credModules.filter((x) => x !== m.path));
                        }}
                      />
                      <span>{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setCredDialogOpen(false)} disabled={savingCred}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingCred}>
                {savingCred ? "Salvando…" : "Salvar Acesso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
