import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadPeriod, errMsg, type DayRow } from "@/lib/data";
import {
  getTreatmentConflicts,
  replaceTreatmentConflicts,
  suggestNextFreeInterval,
  type ConflictingRecordInfo,
} from "@/lib/treatment-conflicts";
import { COV_LABEL, brl, brlValue, fmtDate, hhmm, hours } from "@/lib/format";
import { useDefaultPeriod } from "@/hooks/use-period";
import { coverageIntervals, minToHHMM, suggestCoverageCents, total } from "@/lib/calc";
import { ContractSelect, DataTable, Field, PageHeader, Pill, useDefaultContract, type Tone } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShiftTimeline } from "@/components/shift-timeline";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/coberturas")({
  head: () => ({ meta: [{ title: "Coberturas — Portal do Supervisor" }] }),
  component: Coberturas,
});

const covTone = (s: string): Tone => (s === "realizada" ? "success" : s === "cancelada" ? "neutral" : s === "confirmada" ? "info" : "warning");

function Coberturas() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["period", contract, from, to], queryFn: () => loadPeriod(contract, from, to), enabled: !!contract });
  const refresh = () => qc.invalidateQueries({ queryKey: ["period"] });

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("coverages").update(patch).eq("id", id);
    if (error) toast.error(errMsg(error)); else refresh();
  };
  const openNeeds = (data?.rows ?? []).filter((r) => r.result.uncoveredMin > 0);

  return (
    <div>
      <PageHeader title="Coberturas" description="Posto coberto não gera desconto do cliente; o valor da cobertura é despesa separada."
        actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova cobertura</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      {openNeeds.length > 0 && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">{openNeeds.length} posto(s)/dia com horas descobertas no período</p>
          <p className="text-muted-foreground">{openNeeds.slice(0, 6).map((r) => `${fmtDate(r.schedule.work_date)} ${r.post?.code} (${r.result.uncoveredIntervals.map(([a, b]) => `${minToHHMM(a)}–${minToHHMM(b)}`).join(", ")})`).join(" · ")}{openNeeds.length > 6 ? " …" : ""}</p>
        </div>
      )}
      <DataTable rows={data?.coverages ?? []} rowKey={(c: any) => c.id}
        search={(c: any) => `${c.post?.code} ${c.day_worker?.name ?? ""} ${c.employee?.name ?? ""}`}
        cols={[
          { header: "Data", cell: (c: any) => fmtDate(c.work_date) },
          { header: "Posto", cell: (c: any) => c.post?.code },
          { header: "Responsável", cell: (c: any) => <div><p>{c.day_worker?.name ?? c.employee?.name}</p><p className="text-xs text-muted-foreground">{c.coverer_type === "diarista" ? "Diarista" : "Funcionário"}</p></div> },
          { header: "Horário", cell: (c: any) => `${hhmm(c.start_time)}–${hhmm(c.end_time)}${c.break_start ? ` (int. ${hhmm(c.break_start)}–${hhmm(c.break_end)})` : ""}` },
          { header: "Horas", cell: (c: any) => hours(total(coverageIntervals(c))) },
          { header: "Valor", cell: (c: any) => <span className="num">{brlValue(c.agreed_value)}</span> },
          { header: "Situação", cell: (c: any) => (
            <Select value={c.status} onValueChange={(v) => update(c.id, { status: v })}>
              <SelectTrigger className="h-8 w-36"><Pill tone={covTone(c.status)}>{COV_LABEL[c.status]}</Pill></SelectTrigger>
              <SelectContent>{Object.entries(COV_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          ) },
          { header: "Pagamento", cell: (c: any) => (
            <Button size="sm" variant="outline" onClick={() => update(c.id, { payment_status: c.payment_status === "pago" ? "pendente" : "pago" })}>
              <Pill tone={c.payment_status === "pago" ? "success" : "warning"}>{c.payment_status === "pago" ? "Pago" : "Pendente"}</Pill>
            </Button>
          ) },
        ]} />
      {open && <NewCoverage contract={contract} rows={data?.rows ?? []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function NewCoverage({ contract, rows, onClose, onSaved }: { contract: string; rows: DayRow[]; onClose: () => void; onSaved: () => void }) {
  const needs = rows.filter((r) => r.result.needMin > 0);
  const [needId, setNeedId] = useState(needs.find((r) => r.result.uncoveredMin > 0)?.schedule.id ?? "");
  const need = needs.find((r) => r.schedule.id === needId);
  const [type, setType] = useState<"diarista" | "funcionario">("diarista");
  const [person, setPerson] = useState("");

  const suggestion = useMemo(() => {
    if (!need) return null;
    return suggestNextFreeInterval(need.schedule, need.attendance, need.coverages, need.treatments);
  }, [need]);

  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [bs, setBs] = useState("12:00");
  const [be, setBe] = useState("13:00");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("realizada");
  const [busy, setBusy] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; conflicts: ConflictingRecordInfo[]; execute: () => Promise<void> } | null>(null);

  // Auto-fill times when selecting an occurrence
  useEffect(() => {
    if (suggestion) {
      setStart(suggestion.start);
      setEnd(suggestion.end);
      if (need?.schedule.break_start) setBs(need.schedule.break_start.slice(0, 5));
      if (need?.schedule.break_end) setBe(need.schedule.break_end.slice(0, 5));
    }
  }, [needId]);

  const applySuggestion = () => {
    if (suggestion) {
      setStart(suggestion.start);
      setEnd(suggestion.end);
      toast.info(`Horário sugerido preenchido: ${suggestion.start}–${suggestion.end}`);
    }
  };

  const { data: dws } = useQuery({ queryKey: ["dws-active"], queryFn: async () => (await supabase.from("day_workers").select("*").eq("status", "ativo").order("code")).data ?? [] });
  const { data: emps } = useQuery({ queryKey: ["emps-active"], queryFn: async () => (await supabase.from("employees").select("id, registration, name").eq("status", "ativo").order("registration")).data ?? [] });

  const useBreak = toMinSafe(bs) > toMinSafe(start) && toMinSafe(be) < toMinSafe(end);
  const minutes = total(coverageIntervals({ start_time: start, end_time: end, break_start: useBreak ? bs : null, break_end: useBreak ? be : null, status: "", agreed_value: 0 }));
  const dw = dws?.find((d: any) => d.id === person);
  const suggested = useMemo(() => (type === "diarista" && dw ? suggestCoverageCents(minutes, need?.result.requiredMin ?? 480, dw.day_rate, dw.hour_rate) : 0), [type, dw, minutes, need]);

  const executeInsert = async () => {
    if (!need) return;
    const { error } = await supabase.from("coverages").insert({
      contract_id: contract, post_id: need.schedule.post_id, attendance_id: need.attendance?.id ?? null, work_date: need.schedule.work_date,
      coverer_type: type, day_worker_id: type === "diarista" ? person : null, employee_id: type === "funcionario" ? person : null,
      start_time: start, end_time: end, break_start: useBreak ? bs : null, break_end: useBreak ? be : null,
      agreed_value: value !== "" ? Number(value.replace(",", ".")) : suggested / 100, status,
    });
    if (error) throw error;
  };

  const save = async (): Promise<any> => {
    if (!need || !person) return toast.error("Selecione a ocorrência e a pessoa.");
    if (!start || !end || end <= start || minutes <= 0) return toast.error("Informe um período válido dentro da jornada.");
    setBusy(true);
    try {
      if (need.attendance) {
        const candidate = {
          start_time: start,
          end_time: end,
          break_start: useBreak ? bs : null,
          break_end: useBreak ? be : null,
          status,
          coverer_type: type,
        };
        const { conflicts } = await getTreatmentConflicts(need.schedule, need.attendance, candidate, true);

        if (conflicts.length > 0) {
          setConflictDialog({
            open: true,
            conflicts,
            execute: async () => {
              setBusy(true);
              try {
                await replaceTreatmentConflicts(conflicts);
                await executeInsert();
                toast.success("Tratamento anterior substituído e cobertura registrada com sucesso.");
                onSaved();
              } catch (err) {
                toast.error(errMsg(err));
              } finally {
                setBusy(false);
                setConflictDialog(null);
              }
            },
          });
          return;
        }
      }

      await executeInsert();
      toast.success("Cobertura registrada.");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova cobertura</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Ocorrência / posto a cobrir">
            <Select value={needId} onValueChange={setNeedId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{needs.map((r) => <SelectItem key={r.schedule.id} value={r.schedule.id}>{fmtDate(r.schedule.work_date)} · {r.post?.code} · {r.employee?.registration} · {hours(r.result.uncoveredMin)} descob.</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          {/* Visual shift timeline */}
          {need && (
            <ShiftTimeline
              schedule={need.schedule}
              attendance={need.attendance}
              coverages={need.coverages}
              treatments={need.treatments}
            />
          )}

          {suggestion?.fullyCovered && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
              ✓ Esta ocorrência já está 100% coberta/tratada. Se salvar neste horário, poderá substituir o registro anterior.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={type} onValueChange={(v) => { setType(v as any); setPerson(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="diarista">Diarista</SelectItem><SelectItem value="funcionario">Outro funcionário</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Pessoa">
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(type === "diarista" ? dws ?? [] : emps ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code ?? p.registration} — {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Período da cobertura</span>
            {suggestion && suggestion.pendingMinutes > 0 && (start !== suggestion.start || end !== suggestion.end) && (
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs text-primary" onClick={applySuggestion}>
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Preencher livre ({suggestion.start}–{suggestion.end})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Field label="Início"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Fim"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Int. início"><Input type="time" value={bs} onChange={(e) => setBs(e.target.value)} /></Field>
            <Field label="Int. fim"><Input type="time" value={be} onChange={(e) => setBe(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">Horas cobertas: {hours(minutes)}{useBreak ? " (intervalo descontado)" : " (intervalo fora do período)"}. Valor sugerido: {brl(suggested)}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor combinado (R$)"><Input inputMode="decimal" placeholder={(suggested / 100).toFixed(2)} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            <Field label="Situação">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COV_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>

      {/* 1-Click Conflict Replacement Confirmation Modal */}
      <AlertDialog open={!!conflictDialog?.open} onOpenChange={(o) => !o && setConflictDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir tratamento conflitante?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>Já existe um tratamento registrado para este período que sobrepõe a nova cobertura:</span>
              <span className="mt-2 block rounded-md bg-muted p-2 font-medium text-foreground">
                {conflictDialog?.conflicts.map((c) => `• ${c.label} (${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)})`).join("\n")}
              </span>
              <span>Deseja substituir pelo novo? O registro anterior será inativado/cancelado no histórico e a nova cobertura será salva.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictDialog(null)}>Não, ajustar horários</AlertDialogCancel>
            <AlertDialogAction onClick={() => conflictDialog?.execute()}>Sim, substituir agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function toMinSafe(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
