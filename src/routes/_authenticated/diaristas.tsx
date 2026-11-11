import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Save, Ban, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useContracts } from "@/hooks/use-auth";
import { DataTable, Field, PageHeader, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { brlValue, fmtDate, todaySP } from "@/lib/format";
import { dayTotal, maskedCpf, moneyNumber, normalizeCpf, repeatedDay, SHIFT_LABEL, validCpf, type DayEntry, type DayShift } from "@/lib/day-control";

export const Route = createFileRoute("/_authenticated/diaristas")({
  head: () => ({ meta: [
    { title: "Controle de dias — Caroldo Supervisor" },
    { name: "description", content: "Controle de diárias, substituições, turnos e passagens por contrato." },
    { property: "og:title", content: "Controle de dias — Caroldo Supervisor" },
    { property: "og:description", content: "Lançamentos de diárias e despesas de transporte no Portal do Supervisor." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DayControlPage,
});

type Draft = { id: string; code: string; contract_id: string; absent_name: string; absent_cpf: string; worker_name: string; worker_cpf: string; work_date: string; shift: DayShift; daily_value: string; fare_value: string; fare_quantity: string };
const fresh = (contract: string): Draft => ({ id: "", code: "", contract_id: contract, absent_name: "", absent_cpf: "", worker_name: "", worker_cpf: "", work_date: todaySP(), shift: "integral", daily_value: "", fare_value: "0", fare_quantity: "0" });
function conflictMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23P01") return "Já existe diária para o CPF da diarista ou da faltante nesta data e turno. Edite ou cancele o lançamento anterior; dia inteiro também ocupa manhã e tarde.";
  if (error.code === "42501") return "Sua conta não tem autorização para este contrato. Entre com uma conta autorizada para lançar diárias.";
  return error.message || "Não foi possível salvar o lançamento.";
}

function DayControlPage() {
  const qc = useQueryClient();
  const { data: contracts = [] } = useContracts();
  const [contractFilter, setContractFilter] = useState("all");
  const [period, setPeriod] = useState(todaySP().slice(0, 7));
  const [shiftFilter, setShiftFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [cancelling, setCancelling] = useState<DayEntry | null>(null);
  const { data: authUser } = useQuery({ queryKey: ["day-control-auth"], queryFn: async () => { const { data } = await supabase.auth.getUser(); return data.user; } });
  const { data: writable = [] } = useQuery({ queryKey: ["day-control-writable", authUser?.id, contracts.map(c => c.id)], enabled: !!authUser,
    queryFn: async () => { const results = await Promise.all(contracts.map(async c => { const { data } = await supabase.rpc("can_write_ops", { _contract: c.id }); return data ? c.id : null; })); return results.filter((id): id is string => id !== null); } });
  const { data: entries = [], isLoading, error } = useQuery({ queryKey: ["day-control-entries", authUser?.id, period, contractFilter], enabled: !!authUser,
    queryFn: async () => {
      let query = supabase.from("day_control_entries").select("*").order("work_date", { ascending: false }).order("code", { ascending: false });
      if (contractFilter !== "all") query = query.eq("contract_id", contractFilter);
      if (period) { const [year, month] = period.split("-").map(Number); const last = new Date(year ?? 2026, month ?? 1, 0).getDate(); query = query.gte("work_date", `${period}-01`).lte("work_date", `${period}-${last}`); }
      const { data, error } = await query; if (error) throw error; return (data ?? []) as DayEntry[];
    } });
  const { data: workers = [] } = useQuery({ queryKey: ["day-control-workers", authUser?.id], enabled: !!authUser, queryFn: async () => { const { data, error } = await supabase.from("day_workers").select("id,name,day_rate").eq("status", "ativo").order("name"); if (error) throw error; return data ?? []; } });
  const { data: employees = [] } = useQuery({ queryKey: ["day-control-employees", authUser?.id], enabled: !!authUser, queryFn: async () => { const { data, error } = await supabase.from("employees").select("id,name").order("name"); if (error) throw error; return data ?? []; } });
  const rows = entries.filter(r => shiftFilter === "all" || r.shift === shiftFilter);
  const totals = useMemo(() => rows.filter(r => r.active).reduce((a, r) => ({ count: a.count + 1, daily: a.daily + Number(r.daily_value), fares: a.fares + Number(r.fare_value) * r.fare_quantity, total: a.total + Number(r.total_value) }), { count: 0, daily: 0, fares: 0, total: 0 }), [rows]);
  const change = (key: keyof Draft, value: string) => { setDraft(prev => prev ? { ...prev, [key]: value } : null); setFormError(""); };
  const edit = (r: DayEntry) => { setFormError(""); setDraft({ ...r, daily_value: String(r.daily_value), fare_value: String(r.fare_value), fare_quantity: String(r.fare_quantity) }); };
  const save = async () => {
    if (!draft || saving) return;
    const daily = moneyNumber(draft.daily_value), fare = moneyNumber(draft.fare_value), quantity = Number(draft.fare_quantity);
    if (!draft.contract_id || !draft.absent_name.trim() || !draft.worker_name.trim() || !draft.work_date || !draft.daily_value.trim()) { setFormError("Preencha contrato, nomes das duas pessoas, data e valor da diária."); return; }
    if (!validCpf(draft.absent_cpf) || !validCpf(draft.worker_cpf)) { setFormError("Informe um CPF válido para a faltante e outro para a diarista."); return; }
    if (normalizeCpf(draft.absent_cpf) === normalizeCpf(draft.worker_cpf)) { setFormError("A faltante e a diarista devem ter CPFs diferentes."); return; }
    if (![daily, fare, quantity].every(Number.isFinite) || daily < 0 || fare < 0 || !Number.isInteger(quantity) || quantity < 0 || quantity > 100) { setFormError("Informe valores positivos ou zero e uma quantidade inteira de passagens entre 0 e 100."); return; }
    if (![daily, fare].every(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001)) { setFormError("Use no máximo duas casas decimais nos valores."); return; }
    setSaving(true);
    try {
      const { data: latest, error: readError } = await supabase.from("day_control_entries").select("*").eq("work_date", draft.work_date).eq("active", true);
      if (readError) throw readError;
      const conflict = repeatedDay((latest ?? []) as DayEntry[], draft);
      if (conflict) { setFormError(`Conflito com ${conflict.code}: já existe lançamento para uma destas pessoas em ${fmtDate(draft.work_date)}, ${SHIFT_LABEL[conflict.shift].toLowerCase()}. Edite ou cancele o anterior.`); return; }
      const payload = { contract_id: draft.contract_id, absent_name: draft.absent_name.trim(), absent_cpf: normalizeCpf(draft.absent_cpf), worker_name: draft.worker_name.trim(), worker_cpf: normalizeCpf(draft.worker_cpf), work_date: draft.work_date, shift: draft.shift, daily_value: daily, fare_value: fare, fare_quantity: quantity };
      const result = draft.id ? await supabase.from("day_control_entries").update(payload).eq("id", draft.id).select().single() : await supabase.from("day_control_entries").insert(payload).select().single();
      if (result.error) throw result.error;
      toast.success(`Lançamento ${result.data.code} salvo.`); setDraft(null); await qc.invalidateQueries({ queryKey: ["day-control-entries"] });
    } catch (e) { setFormError(conflictMessage(e as { code?: string; message?: string })); } finally { setSaving(false); }
  };
  const cancel = async () => {
    if (!cancelling || saving) return; setSaving(true);
    try { const { error } = await supabase.from("day_control_entries").update({ active: false }).eq("id", cancelling.id).select().single(); if (error) throw error; toast.success("Lançamento cancelado; histórico preservado."); setCancelling(null); await qc.invalidateQueries({ queryKey: ["day-control-entries"] }); }
    catch (e) { toast.error(conflictMessage(e as { code?: string; message?: string })); } finally { setSaving(false); }
  };
  const preview = draft ? dayTotal(moneyNumber(draft.daily_value || "0"), moneyNumber(draft.fare_value || "0"), Number(draft.fare_quantity || "0")) : 0;
  return <div className="space-y-5">
    <div className="text-xs text-muted-foreground">Operacional / Supervisor / Controle de dias</div>
    <PageHeader title="Controle de dias" actions={<Button disabled={!writable.length} onClick={() => { setFormError(""); setDraft(fresh(writable.includes(contractFilter) ? contractFilter : writable[0] ?? "")); }}><Plus className="mr-2 h-4 w-4" />Lançar diária</Button>} />
    {!authUser && <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">Para consultar nomes, CPFs e lançar diárias, entre com uma conta autorizada. Os dados não ficam disponíveis no acesso público.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Diárias lançadas" value={totals.count} tone="primary" /><Stat label="Valor das diárias" value={brlValue(totals.daily)} /><Stat label="Passagens" value={brlValue(totals.fares)} /><Stat label="Total a pagar" value={brlValue(totals.total)} tone="success" /></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Contrato"><Select value={contractFilter} onValueChange={setContractFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os contratos</SelectItem>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Mês"><Input type="month" value={period} onChange={e => setPeriod(e.target.value)} /></Field>
      <Field label="Turno"><Select value={shiftFilter} onValueChange={setShiftFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os turnos</SelectItem>{Object.entries(SHIFT_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></Field>
    </div>
    {error ? <p role="alert" className="text-destructive">Não foi possível carregar os lançamentos. Tente atualizar a página.</p> : isLoading ? <p className="text-muted-foreground">Carregando…</p> : <DataTable rows={rows} rowKey={r => r.id} search={r => `${r.code} ${r.absent_name} ${r.worker_name} ${r.work_date}`} cols={[
      { header: "Código", cell: r => <span className="font-mono text-xs">{r.code}</span> },
      { header: "Faltante", cell: r => <div className="min-w-28"><p>{r.absent_name}</p><p className="text-xs text-muted-foreground">{maskedCpf(r.absent_cpf)}</p></div> },
      { header: "Diarista", cell: r => <div className="min-w-28"><p>{r.worker_name}</p><p className="text-xs text-muted-foreground">{maskedCpf(r.worker_cpf)}</p></div> },
      { header: "Data / turno", cell: r => <div className="min-w-28"><p>{fmtDate(r.work_date)}</p><p className="text-xs text-muted-foreground">{SHIFT_LABEL[r.shift]}</p></div> },
      { header: "Diária", cell: r => brlValue(r.daily_value) },
      { header: "Passagens", cell: r => <div className="whitespace-nowrap"><p>{r.fare_quantity} × {brlValue(r.fare_value)}</p><p className="text-xs text-muted-foreground">{brlValue(Number(r.fare_value) * r.fare_quantity)}</p></div> },
      { header: "Total", cell: r => <span className="whitespace-nowrap font-semibold">{brlValue(r.total_value)}</span> },
      { header: "Situação", cell: r => <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Cancelado"}</Pill> },
      { header: "Ações", cell: r => writable.includes(r.contract_id) && r.active ? <div className="flex"><Button size="icon" variant="ghost" aria-label={`Editar ${r.code}`} onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Cancelar ${r.code}`} onClick={() => setCancelling(r)}><Ban className="h-4 w-4" /></Button></div> : null },
    ]} />}
    <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />{draft?.id ? "Editar diária" : "Lançar diária"}</DialogTitle></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código"><Input value={draft?.code || "Gerado automaticamente ao salvar"} disabled /></Field>
          <Field label="Contrato *"><Select value={draft?.contract_id ?? ""} onValueChange={v => change("contract_id", v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{contracts.filter(c => writable.includes(c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <fieldset className="space-y-3 border-t pt-3"><legend className="px-1 text-sm font-semibold">Pessoa faltante</legend><div className="grid gap-3 sm:grid-cols-2"><Field label="Nome da faltante *"><Input required list="absent-names" value={draft?.absent_name ?? ""} onChange={e => change("absent_name", e.target.value)} /></Field><Field label="CPF da faltante *"><Input required inputMode="numeric" maxLength={14} value={draft?.absent_cpf ?? ""} onChange={e => change("absent_cpf", e.target.value)} /></Field></div></fieldset>
        <fieldset className="space-y-3 border-t pt-3"><legend className="px-1 text-sm font-semibold">Diarista substituta</legend><div className="grid gap-3 sm:grid-cols-2"><Field label="Nome da diarista *"><Input required list="worker-names" value={draft?.worker_name ?? ""} onChange={e => { change("worker_name", e.target.value); const worker = workers.find(w => w.name === e.target.value); if (worker) change("daily_value", String(worker.day_rate)); }} /></Field><Field label="CPF da diarista *"><Input required inputMode="numeric" maxLength={14} value={draft?.worker_cpf ?? ""} onChange={e => change("worker_cpf", e.target.value)} /></Field></div></fieldset>
        <datalist id="absent-names">{employees.map(e => <option key={e.id} value={e.name} />)}</datalist><datalist id="worker-names">{workers.map(w => <option key={w.id} value={w.name} />)}</datalist>
        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2"><Field label="Data *"><Input required type="date" value={draft?.work_date ?? ""} onChange={e => change("work_date", e.target.value)} /></Field><Field label="Turno *"><Select value={draft?.shift ?? "integral"} onValueChange={v => change("shift", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SHIFT_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Valor da diária (R$) *"><Input required inputMode="decimal" value={draft?.daily_value ?? ""} onChange={e => change("daily_value", e.target.value)} /></Field><Field label="Valor de cada passagem (R$)"><Input required inputMode="decimal" value={draft?.fare_value ?? "0"} onChange={e => change("fare_value", e.target.value)} /></Field><Field label="Quantidade de passagens"><Input required type="number" min={0} max={100} step={1} value={draft?.fare_quantity ?? "0"} onChange={e => change("fare_quantity", e.target.value)} /></Field></div>
        <div className="flex items-center justify-between border-y py-3"><span className="font-medium">Total: diária + passagens</span><strong className="text-xl text-primary">{brlValue(Number.isFinite(preview) ? preview : 0)}</strong></div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancelar</Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar diária"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
    <AlertDialog open={!!cancelling} onOpenChange={open => { if (!open && !saving) setCancelling(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar {cancelling?.code}?</AlertDialogTitle><AlertDialogDescription>O lançamento sai dos totais, mas permanece no histórico. O turno fica disponível para outro lançamento.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={e => { e.preventDefault(); void cancel(); }}>Confirmar cancelamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
