import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  History,
  Pencil,
  Plus,
  Clock,
  Moon,
  Sparkles,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DemoBadge, Field, Pill, PageHeader, DataTable, type Col } from "@/components/ui-kit";
import { useContracts, useMe } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import { errMsg } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  type DaySchedule,
  createDefaultSchedule,
  calculateShiftMinutes,
  isOvernightShift,
  formatMinutesToHours,
  formatScheduleSummary,
  loadEmployeeSchedule,
  saveEmployeeSchedule,
  syncEmployeeSchedulesToDb,
} from "@/lib/employee-schedules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Portal do Supervisor" }] }),
  component: Funcionarios,
});

export function Funcionarios() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canEdit = me?.has("admin");

  const [hist, setHist] = useState<any>(null);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [viewScheduleEmp, setViewScheduleEmp] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Load all employees with assignments
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["crud", "employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, assignments:employee_assignments(id, contract_id, post_id, start_date, end_date, contract:contracts(id, code, name), post:posts(id, code, role_name))")
        .order("registration");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter !== "todos" && emp.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const term = searchFilter.toLowerCase();
        const reg = (emp.registration || "").toLowerCase();
        const name = (emp.name || "").toLowerCase();
        const role = (emp.role_name || "").toLowerCase();
        const activeAssignment = (emp.assignments ?? []).find((a: any) => !a.end_date);
        const contractCode = (activeAssignment?.contract?.code || "").toLowerCase();
        const postCode = (activeAssignment?.post?.code || "").toLowerCase();
        if (
          !reg.includes(term) &&
          !name.includes(term) &&
          !role.includes(term) &&
          !contractCode.includes(term) &&
          !postCode.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [employees, statusFilter, searchFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "ativo").length;
    const afastados = employees.filter((e) => e.status === "afastado").length;
    const inativos = employees.filter((e) => e.status === "inativo").length;
    return { total, active, afastados, inativos };
  }, [employees]);

  return (
    <div className="space-y-4">
      {/* Breadcrumb da hierarquia Operacional > Efetividade */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1">
        <span>Operacional</span>
        <span>/</span>
        <span className="text-muted-foreground">Efetividade</span>
        <span>/</span>
        <span className="text-foreground font-semibold">Funcionários</span>
      </div>

      <PageHeader
        title="Funcionários"
        description="Cadastro de colaboradores com gestão integrada de contratos, postos vinculados e horários de trabalho."
        actions={
          canEdit && (
            <Button
              onClick={() =>
                setEditingEmp({
                  registration: "",
                  name: "",
                  role_name: "Servente de Limpeza",
                  status: "ativo",
                  admission_date: new Date().toISOString().slice(0, 10),
                  isNew: true,
                })
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Funcionário
            </Button>
          )
        }
      />

      {/* Metrics Bar & Search / Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-lg border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium">
            Total: <span className="font-bold ml-1">{stats.total}</span>
          </Badge>
          <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300">
            Ativos: <span className="font-bold ml-1">{stats.active}</span>
          </Badge>
          {stats.afastados > 0 && (
            <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300">
              Afastados: <span className="font-bold ml-1">{stats.afastados}</span>
            </Badge>
          )}
          {stats.inativos > 0 && (
            <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground">
              Inativos: <span className="font-bold ml-1">{stats.inativos}</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, matrícula, posto..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="afastado">Afastados</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Carregando quadro de colaboradores...</p>
      ) : (
        <DataTable
          rows={filteredEmployees}
          rowKey={(r) => r.id}
          pageSize={20}
          search={(r) => `${r.registration} ${r.name} ${r.role_name}`}
          cols={[
            {
              header: "Matrícula",
              cell: (r) => <span className="font-mono text-xs font-semibold">{r.registration}</span>,
            },
            {
              header: "Nome",
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <DemoBadge show={r.is_demo} />
                </div>
              ),
            },
            { header: "Função", cell: (r) => r.role_name || "—" },
            { header: "Admissão", cell: (r) => fmtDate(r.admission_date) },
            {
              header: "Vínculo Atual",
              cell: (r) => {
                const a = (r.assignments ?? []).find((x: any) => !x.end_date);
                if (!a) return <span className="text-muted-foreground text-xs italic">Sem vínculo</span>;
                return (
                  <Badge variant="outline" className="text-xs font-mono font-normal">
                    {a.contract?.code} / {a.post?.code ?? "Sem Posto"}
                  </Badge>
                );
              },
            },
            {
              header: "Horário de Trabalho",
              cell: (r) => {
                const schedule = loadEmployeeSchedule(r.id);
                const summary = formatScheduleSummary(schedule);
                const hasNightShift = schedule.some((d) => d.enabled && isOvernightShift(d.startTime, d.endTime));
                return (
                  <button
                    type="button"
                    onClick={() => setViewScheduleEmp(r)}
                    className="group flex items-center gap-1.5 text-left text-xs hover:opacity-80 transition-opacity"
                    title="Clique para visualizar o quadro completo de horários"
                  >
                    <Badge
                      variant="secondary"
                      className="font-mono text-[11px] px-2 py-0.5 flex items-center gap-1 group-hover:border-primary/50"
                    >
                      {hasNightShift ? (
                        <Moon className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Clock className="h-3 w-3 text-primary" />
                      )}
                      <span>{summary}</span>
                    </Badge>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                );
              },
            },
            {
              header: "Situação",
              cell: (r) => (
                <Pill tone={r.status === "ativo" ? "success" : r.status === "afastado" ? "info" : "neutral"}>
                  {r.status}
                </Pill>
              ),
            },
            {
              header: "Vínculos",
              cell: (r) => (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Histórico de Vínculos Contratuais"
                  onClick={() => setHist(r)}
                  className="h-8 w-8 p-0"
                >
                  <History className="h-4 w-4 text-muted-foreground" />
                </Button>
              ),
            },
            ...(canEdit
              ? ([
                  {
                    header: "",
                    cell: (r: any) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Editar Funcionário e Horários"
                        onClick={() => setEditingEmp(r)}
                        className="h-8 w-8 p-0 text-primary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ),
                  },
                ] as Col<any>[])
              : []),
          ]}
        />
      )}

      {/* MODAL: Histórico de Vínculos */}
      {hist && <Assignments emp={hist} onClose={() => setHist(null)} />}

      {/* MODAL: Visualizar Horários de Trabalho */}
      {viewScheduleEmp && (
        <ViewScheduleDialog
          emp={viewScheduleEmp}
          onClose={() => setViewScheduleEmp(null)}
          onEdit={() => {
            const current = viewScheduleEmp;
            setViewScheduleEmp(null);
            if (canEdit) setEditingEmp(current);
          }}
          canEdit={canEdit}
        />
      )}

      {/* MODAL: Criar / Editar Funcionário com Horário de Trabalho */}
      {editingEmp && (
        <EmployeeFormDialog
          employee={editingEmp}
          onClose={() => setEditingEmp(null)}
          onSaved={() => {
            setEditingEmp(null);
            qc.invalidateQueries({ queryKey: ["crud", "employees"] });
            qc.invalidateQueries({ queryKey: ["schedules"] });
            qc.invalidateQueries({ queryKey: ["period"] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL: Visualização Completa de Horários
// ---------------------------------------------------------------------------

function ViewScheduleDialog({
  emp,
  onClose,
  onEdit,
  canEdit,
}: {
  emp: any;
  onClose: () => void;
  onEdit: () => void;
  canEdit?: boolean;
}) {
  const schedule = useMemo(() => loadEmployeeSchedule(emp.id), [emp.id]);
  const activeDays = schedule.filter((d) => d.enabled);
  const totalWeeklyMinutes = activeDays.reduce((acc, d) => acc + calculateShiftMinutes(d), 0);
  const hasOvernight = activeDays.some((d) => isOvernightShift(d.startTime, d.endTime));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-primary" />
            Horário de Trabalho — {emp.name} ({emp.registration})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-lg border text-center text-xs">
            <div>
              <span className="text-muted-foreground block">Dias Trabalhados</span>
              <span className="font-bold text-foreground text-sm">{activeDays.length} dias / semana</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Carga Semanal</span>
              <span className="font-bold text-primary text-sm">{formatMinutesToHours(totalWeeklyMinutes)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Turno Noturno</span>
              <span className="font-bold text-foreground text-sm">
                {hasOvernight ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                    <Moon className="h-3 w-3" /> Sim (+1 dia)
                  </span>
                ) : (
                  "Não"
                )}
              </span>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground border-b font-medium">
                <tr>
                  <th className="py-2 px-3 text-left">Dia da Semana</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Jornada</th>
                  <th className="py-2 px-3 text-center">Intervalo</th>
                  <th className="py-2 px-3 text-right">Horas Líquidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedule.map((d) => {
                  const dayMin = calculateShiftMinutes(d);
                  const isNight = isOvernightShift(d.startTime, d.endTime);
                  return (
                    <tr key={d.dayOfWeek} className={d.enabled ? "bg-background" : "bg-muted/20 text-muted-foreground"}>
                      <td className="py-2 px-3 font-medium">
                        {d.dayLabel}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {d.enabled ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 text-[10px] px-1.5 py-0">
                            Trabalha
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">
                            Folga
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {d.enabled ? (
                          <span className="flex items-center justify-center gap-1">
                            {d.startTime} às {d.endTime}
                            {isNight && (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] px-1 py-0 border-amber-400">
                                +1d
                              </Badge>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {d.enabled && d.hasBreak && d.breakStart && d.breakEnd ? (
                          `${d.breakStart}–${d.breakEnd}`
                        ) : (
                          <span className="text-muted-foreground">Sem intervalo</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {d.enabled ? formatMinutesToHours(dayMin) : "0h00"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between items-center">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
          {canEdit && (
            <Button size="sm" onClick={onEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Editar Horários
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MODAL: Criar / Editar Funcionário com Horário de Trabalho
// ---------------------------------------------------------------------------

function EmployeeFormDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = Boolean(employee.isNew);
  const { data: contracts = [] } = useContracts();

  // Basic Form Fields
  const [registration, setRegistration] = useState(employee.registration || "");
  const [name, setName] = useState(employee.name || "");
  const [roleName, setRoleName] = useState(employee.role_name || "Servente de Limpeza");
  const [admissionDate, setAdmissionDate] = useState(
    employee.admission_date || new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState(employee.status || "ativo");

  // Contract Assignment (active or newly selected)
  const activeAssignment = useMemo(() => {
    return (employee.assignments ?? []).find((a: any) => !a.end_date);
  }, [employee]);

  const [contractId, setContractId] = useState<string>(
    activeAssignment?.contract_id || (contracts.length > 0 ? contracts[0].id : "")
  );
  const [postId, setPostId] = useState<string>(activeAssignment?.post_id || "");

  // Fetch posts for selected contract
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, code, role_name, shift, start_time, end_time")
        .eq("contract_id", contractId)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Schedule pattern for the 7 days of the week
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    if (employee.id) {
      return loadEmployeeSchedule(employee.id);
    }
    return createDefaultSchedule();
  });

  const [isSaving, setIsSaving] = useState(false);

  // Update schedule day
  const updateDay = (dayOfWeek: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
  };

  // Quick Preset Actions
  const applyPresetCommercial = () => {
    setSchedule((prev) =>
      prev.map((d) => {
        const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
        return {
          ...d,
          enabled: isWeekday,
          startTime: "08:00",
          endTime: "17:00",
          hasBreak: true,
          breakStart: "12:00",
          breakEnd: "13:00",
        };
      })
    );
    toast.success("Horário comercial aplicado (Seg–Sex 08:00 às 17:00).");
  };

  const applyPresetMorning = () => {
    setSchedule((prev) =>
      prev.map((d) => {
        const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
        return {
          ...d,
          enabled: isWeekday,
          startTime: "07:00",
          endTime: "16:00",
          hasBreak: true,
          breakStart: "11:30",
          breakEnd: "12:30",
        };
      })
    );
    toast.success("Horário matutino aplicado (Seg–Sex 07:00 às 16:00).");
  };

  const applyPresetNight = () => {
    setSchedule((prev) =>
      prev.map((d) => {
        const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
        return {
          ...d,
          enabled: isWeekday,
          startTime: "22:00",
          endTime: "06:00",
          hasBreak: true,
          breakStart: "02:00",
          breakEnd: "03:00",
        };
      })
    );
    toast.info("Escala noturna aplicada (22:00 às 06:00, encerra no dia seguinte +1d).");
  };

  const copyMondayToWeekdays = () => {
    const monday = schedule.find((d) => d.dayOfWeek === 1);
    if (!monday) return;
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek >= 2 && d.dayOfWeek <= 5) {
          return {
            ...d,
            enabled: monday.enabled,
            startTime: monday.startTime,
            endTime: monday.endTime,
            hasBreak: monday.hasBreak,
            breakStart: monday.breakStart,
            breakEnd: monday.breakEnd,
          };
        }
        return d;
      })
    );
    toast.success("Horário de Segunda-feira copiado para Terça a Sexta!");
  };

  // Weekly stats
  const activeDays = schedule.filter((d) => d.enabled);
  const totalWeeklyMinutes = activeDays.reduce((acc, d) => acc + calculateShiftMinutes(d), 0);
  const hasOvernight = activeDays.some((d) => isOvernightShift(d.startTime, d.endTime));

  // Save Employee & Schedules
  const handleSave = async () => {
    if (!registration.trim() || !name.trim()) {
      toast.error("Preencha Matrícula e Nome do colaborador.");
      return;
    }

    setIsSaving(true);
    try {
      let savedEmpId = employee.id;

      const employeePayload = {
        registration: registration.trim(),
        name: name.trim(),
        role_name: roleName.trim(),
        admission_date: admissionDate || null,
        status: status || "ativo",
      };

      if (isNew) {
        const { data: inserted, error: insertErr } = await supabase
          .from("employees")
          .insert(employeePayload)
          .select()
          .single();
        if (insertErr) throw insertErr;
        savedEmpId = inserted.id;
      } else {
        const { error: updateErr } = await supabase
          .from("employees")
          .update(employeePayload)
          .eq("id", employee.id);
        if (updateErr) throw updateErr;
      }

      // Save work schedule pattern to localStorage
      saveEmployeeSchedule(savedEmpId, schedule);

      // Handle contract / post assignment if selected
      if (contractId) {
        const isAssignmentChanged =
          activeAssignment?.contract_id !== contractId ||
          activeAssignment?.post_id !== postId;

        if (isAssignmentChanged) {
          const today = new Date().toISOString().slice(0, 10);
          // Terminate active assignment if existing
          if (activeAssignment?.id) {
            await supabase
              .from("employee_assignments")
              .update({ end_date: today })
              .eq("id", activeAssignment.id);
          }
          // Insert new assignment
          await supabase.from("employee_assignments").insert({
            employee_id: savedEmpId,
            contract_id: contractId,
            post_id: postId || null,
            start_date: today,
          });
        }

        // Synchronize schedules table forward for active employees so attendance / conferencia have the exact hours
        if (status === "ativo" && postId) {
          await syncEmployeeSchedulesToDb(savedEmpId, contractId, postId, schedule);
        }
      }

      toast.success(
        `Funcionário ${name} e quadro de horários salvos com sucesso!`
      );
      onSaved();
    } catch (err: any) {
      console.error("[EmployeeFormDialog] Erro ao salvar:", err);
      toast.error(errMsg(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {isNew ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </span>
            {isNew ? "Novo Funcionário" : `Editar Funcionário — ${name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Tabs defaultValue="cadastro" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="cadastro" className="text-xs">
                1. Dados Cadastrais
              </TabsTrigger>
              <TabsTrigger value="vinculo" className="text-xs">
                2. Vínculo Operacional
              </TabsTrigger>
              <TabsTrigger value="horarios" className="text-xs">
                3. Horário de Trabalho
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DADOS CADASTRAIS */}
            <TabsContent value="cadastro" className="space-y-4 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Matrícula (Identificador Principal) *">
                  <Input
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    placeholder="Ex: ST001, 10245"
                    className="font-mono font-semibold"
                  />
                </Field>

                <Field label="Nome Completo *">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do colaborador"
                  />
                </Field>

                <Field label="Função / Cargo">
                  <Input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Ex: Servente de Limpeza, Vigilante"
                  />
                </Field>

                <Field label="Data de Admissão">
                  <Input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                  />
                </Field>

                <Field label="Situação Cadastral" className="sm:col-span-2">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo (em operação normal)</SelectItem>
                      <SelectItem value="afastado">Afastado (licença / atestado prolongado)</SelectItem>
                      <SelectItem value="inativo">Inativo (desligado / suspenso)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </TabsContent>

            {/* TAB 2: VÍNCULO OPERACIONAL */}
            <TabsContent value="vinculo" className="space-y-4 m-0">
              <div className="bg-muted/30 p-3 rounded-lg border text-xs text-muted-foreground">
                Associe o colaborador a um contrato e posto de trabalho para sincronização automática da escala e cálculo de efetividade.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Contrato de Atuação">
                  <Select value={contractId} onValueChange={setContractId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} {c.name ? `— ${c.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Posto de Trabalho Vinculado">
                  <Select value={postId} onValueChange={setPostId}>
                    <SelectTrigger>
                      <SelectValue placeholder={contractId ? "Selecione o posto" : "Primeiro selecione o contrato"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(Nenhum posto fixo atribuído)</SelectItem>
                      {posts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.role_name || "Posto"} ({p.shift || "Geral"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {activeAssignment && (
                <div className="p-3 bg-card border rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-foreground block">Vínculo Atual Registrado:</span>
                  <span className="text-muted-foreground block">
                    Contrato: <strong className="text-foreground">{activeAssignment.contract?.code}</strong> • Posto: <strong className="text-foreground">{activeAssignment.post?.code || "—"}</strong> • Desde: {fmtDate(activeAssignment.start_date)}
                  </span>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: HORÁRIO DE TRABALHO (DIAS DA SEMANA, ENTRADA, SAÍDA, INTERVALO, NOTURNO) */}
            <TabsContent value="horarios" className="space-y-4 m-0">
              {/* Quick Presets Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">Preenchimento Rápido:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={applyPresetCommercial}
                  >
                    Seg–Sex 08h–17h
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={applyPresetMorning}
                  >
                    Seg–Sex 07h–16h
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300"
                    onClick={applyPresetNight}
                  >
                    <Moon className="h-3 w-3 mr-1" />
                    Noturno 22h–06h (+1d)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-primary hover:text-primary"
                    onClick={copyMondayToWeekdays}
                    title="Copia os horários configurados na Segunda-feira para Terça, Quarta, Quinta e Sexta"
                  >
                    Copiar Seg p/ Ter–Sex
                  </Button>
                </div>
              </div>

              {/* Weekly Timetable Table */}
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground border-b font-medium">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-28">Dia</th>
                      <th className="py-2.5 px-3 text-left w-20">Ativo</th>
                      <th className="py-2.5 px-3 text-left">Entrada / Saída</th>
                      <th className="py-2.5 px-3 text-left">Intervalo de Refeição</th>
                      <th className="py-2.5 px-3 text-right w-24">Carga / Dia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.map((day) => {
                      const isNight = isOvernightShift(day.startTime, day.endTime);
                      const dayMin = calculateShiftMinutes(day);

                      return (
                        <tr
                          key={day.dayOfWeek}
                          className={day.enabled ? "bg-background" : "bg-muted/20 text-muted-foreground"}
                        >
                          <td className="py-2 px-3 font-semibold">
                            {day.dayLabel}
                          </td>

                          <td className="py-2 px-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <Checkbox
                                checked={day.enabled}
                                onCheckedChange={(checked) =>
                                  updateDay(day.dayOfWeek, { enabled: Boolean(checked) })
                                }
                              />
                              <span className="text-[11px] select-none">
                                {day.enabled ? "Trabalha" : "Folga"}
                              </span>
                            </label>
                          </td>

                          <td className="py-2 px-3">
                            {day.enabled ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="time"
                                  value={day.startTime}
                                  onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                                  className="h-7 w-20 text-xs px-1.5 font-mono text-center"
                                />
                                <span className="text-muted-foreground">às</span>
                                <Input
                                  type="time"
                                  value={day.endTime}
                                  onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                                  className="h-7 w-20 text-xs px-1.5 font-mono text-center"
                                />
                                {isNight && (
                                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-400 text-[10px] px-1.5 py-0 flex items-center gap-1 shrink-0">
                                    <Moon className="h-2.5 w-2.5" />
                                    +1 dia
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Não escalado</span>
                            )}
                          </td>

                          <td className="py-2 px-3">
                            {day.enabled ? (
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                  <Checkbox
                                    checked={day.hasBreak}
                                    onCheckedChange={(checked) =>
                                      updateDay(day.dayOfWeek, { hasBreak: Boolean(checked) })
                                    }
                                  />
                                  <span className="text-[10px] text-muted-foreground select-none">Int.</span>
                                </label>

                                {day.hasBreak && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="time"
                                      value={day.breakStart}
                                      onChange={(e) => updateDay(day.dayOfWeek, { breakStart: e.target.value })}
                                      className="h-7 w-16 text-xs px-1 font-mono text-center"
                                    />
                                    <span className="text-muted-foreground text-[10px]">–</span>
                                    <Input
                                      type="time"
                                      value={day.breakEnd}
                                      onChange={(e) => updateDay(day.dayOfWeek, { breakEnd: e.target.value })}
                                      className="h-7 w-16 text-xs px-1 font-mono text-center"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {day.enabled ? formatMinutesToHours(dayMin) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Weekly Summary Card */}
              <div className="grid grid-cols-3 gap-2 bg-card p-3 rounded-lg border text-center text-xs">
                <div>
                  <span className="text-muted-foreground block">Dias de Escala:</span>
                  <span className="font-bold text-foreground text-sm">{activeDays.length} dias</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Carga Semanal Prevista:</span>
                  <span className="font-bold text-primary text-sm">{formatMinutesToHours(totalWeeklyMinutes)} / sem</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Jornada Cruzada (Noturna):</span>
                  <span className="font-bold text-foreground text-sm">
                    {hasOvernight ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">Sim (+1 dia)</span>
                    ) : (
                      "Não"
                    )}
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex justify-between sm:justify-between items-center">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? "Gravando..." : isNew ? "Cadastrar Funcionário" : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MODAL: Histórico de Vínculos Contratuais (Preservado e Intacto)
// ---------------------------------------------------------------------------

function Assignments({ emp, onClose }: { emp: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: contracts } = useContracts();
  const [contract, setContract] = useState("");
  const [post, setPost] = useState("");
  const [start, setStart] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["posts", contract],
    enabled: !!contract,
    queryFn: async () =>
      (
        await supabase
          .from("posts")
          .select("id, code")
          .eq("contract_id", contract)
          .eq("active", true)
          .order("code")
      ).data ?? [],
  });

  const add = async (): Promise<any> => {
    if (!contract || !start) return toast.error("Informe contrato e início.");
    const current = (emp.assignments ?? []).filter((a: any) => !a.end_date);
    for (const a of current) {
      await supabase.from("employee_assignments").update({ end_date: start }).eq("id", a.id);
    }
    const { error } = await supabase.from("employee_assignments").insert({
      employee_id: emp.id,
      contract_id: contract,
      post_id: post || null,
      start_date: start,
    });
    if (error) return toast.error(errMsg(error));
    toast.success("Vínculo registrado; vínculo anterior encerrado.");
    qc.invalidateQueries({ queryKey: ["crud", "employees"] });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vínculos — {emp.registration} {emp.name}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {(emp.assignments ?? []).map((a: any) => (
            <li key={a.id} className="rounded border p-2">
              {a.contract?.code} · posto {a.post?.code ?? "—"} · {fmtDate(a.start_date)} a {a.end_date ? fmtDate(a.end_date) : "atual"}
            </li>
          ))}
          {!(emp.assignments ?? []).length && (
            <li className="text-muted-foreground">Sem vínculos.</li>
          )}
        </ul>
        {me?.has("admin") && (
          <div className="mt-2 grid gap-2 border-t pt-3">
            <p className="text-sm font-medium">Novo vínculo</p>
            <Select value={contract} onValueChange={setContract}>
              <SelectTrigger>
                <SelectValue placeholder="Contrato" />
              </SelectTrigger>
              <SelectContent>
                {(contracts ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={post} onValueChange={setPost}>
              <SelectTrigger>
                <SelectValue placeholder="Posto" />
              </SelectTrigger>
              <SelectContent>
                {(posts ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Field label="Início">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Button onClick={add}>Adicionar vínculo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
