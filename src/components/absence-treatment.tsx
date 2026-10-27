import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, X, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, type DayRow } from "@/lib/data";
import {
  getTreatmentConflicts,
  replaceTreatmentConflicts,
  suggestNextFreeInterval,
  detectLegacyConflicts,
  type ConflictingRecordInfo,
  type LegacyConflictGroup,
} from "@/lib/treatment-conflicts";
import { computePostDay, coverageIntervals, total, suggestCoverageCents, type AttendanceLike } from "@/lib/calc";
import { brl, hours, hhmm, fmtDateTime } from "@/lib/format";
import { Field, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
export function AbsenceTreatment({ row, attendance, persist, disabled }: { row: DayRow; attendance: AttendanceLike; persist: () => Promise<string>; disabled: boolean }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState("desconto");
  const [person, setPerson] = useState("");
  const [start, setStart] = useState(row.schedule.start_time.slice(0, 5));
  const [end, setEnd] = useState(row.schedule.end_time.slice(0, 5));
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("realizada");
  const [reason, setReason] = useState("");
  const [authorizer, setAuthorizer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; conflicts: ConflictingRecordInfo[]; execute: () => Promise<void> } | null>(null);
  const [legacyDialog, setLegacyDialog] = useState<LegacyConflictGroup | null>(null);

  const key = ["occurrence-treatments", row.schedule.id];
  const { data } = useQuery({ queryKey: key, queryFn: async () => {
    const { data: a, error } = await supabase.from("attendance").select("id").eq("schedule_id", row.schedule.id).maybeSingle();
    if (error) throw error;
    if (!a) return { coverages: [], treatments: [] };
    const [c, t] = await Promise.all([
      supabase.from("coverages").select("*, day_worker:day_workers(name), employee:employees(name), supervisor:profiles!coverages_supervisor_id_fkey(full_name)").eq("contract_id", row.schedule.contract_id).eq("post_id", row.schedule.post_id).eq("work_date", row.schedule.work_date),
      supabase.from("absence_treatments").select("*").eq("attendance_id", a.id).eq("active", true),
    ]);
    if (c.error || t.error) throw c.error ?? t.error;
    return { coverages: (c.data ?? []).filter(c => !c.attendance_id || c.attendance_id === a.id), treatments: t.data ?? [] };
  } });

  const { data: people } = useQuery({ queryKey: ["treatment-people"], queryFn: async () => {
    const [d, e, s] = await Promise.all([
      supabase.from("day_workers").select("*").eq("status", "ativo"),
      supabase.from("employees").select("id,name,registration").eq("status", "ativo"),
      supabase.rpc("list_coverage_supervisors"),
    ]);
    if (d.error || e.error || s.error) throw d.error ?? e.error ?? s.error;
    return { dayWorkers: d.data ?? [], company: [...(e.data ?? []).map(p => ({ key: `employee:${p.id}`, name: `${p.registration} — ${p.name}` })), ...(s.data ?? []).map(p => ({ key: `supervisor:${p.id}`, name: `${p.full_name ?? "Supervisor"} (supervisor)` }))] };
  } });

  const covs = data?.coverages ?? row.coverages;
  const treatments = data?.treatments ?? row.treatments;
  const result = computePostDay(row.schedule, { ...attendance, hour_value: row.attendance?.hour_value ?? row.post?.hour_value }, covs, treatments);
  const minutes = total(coverageIntervals({ start_time: start, end_time: end, break_start: row.schedule.break_start, break_end: row.schedule.break_end, agreed_value: 0, status }));
  const dw = people?.dayWorkers.find(d => d.id === person);
  const suggested = kind === "diarista" && dw ? suggestCoverageCents(minutes, result.requiredMin, dw.day_rate, dw.hour_rate) : 0;

  const suggestion = suggestNextFreeInterval(row.schedule, attendance, covs, treatments);
  const legacyConflicts = detectLegacyConflicts(row.schedule, attendance, covs, treatments);

  const refresh = async () => { await qc.invalidateQueries({ queryKey: key }); await qc.invalidateQueries({ queryKey: ["period"] }); };
  const reset = () => {
    setEditing(null);
    setPerson("");
    setValue("");
    setReason("");
    setAuthorizer("");
    setFile(null);
    if (!suggestion.fullyCovered) {
      setStart(suggestion.start);
      setEnd(suggestion.end);
    }
  };

  const applySuggestion = () => {
    setStart(suggestion.start);
    setEnd(suggestion.end);
    toast.info(`Horário sugerido preenchido: ${suggestion.start}–${suggestion.end}`);
  };

  const edit = (record: any, isCoverage: boolean) => {
    setEditing({ ...record, isCoverage }); setKind(isCoverage ? record.coverer_type : record.kind);
    setStart(record.start_time.slice(0, 5)); setEnd(record.end_time.slice(0, 5));
    setPerson(record.day_worker_id ?? (record.employee_id ? `employee:${record.employee_id}` : record.supervisor_id ? `supervisor:${record.supervisor_id}` : ""));
    setValue(String(record.agreed_value ?? "")); setStatus(record.status ?? "realizada"); setReason(record.reason ?? ""); setAuthorizer(record.authorized_by ?? "");
  };

  const executeSave = async (aid: string, isCoverage: boolean, amount: number) => {
    if (isCoverage) {
      const payload = {
        contract_id: row.schedule.contract_id, post_id: row.schedule.post_id, attendance_id: aid, work_date: row.schedule.work_date, coverer_type: kind,
        day_worker_id: kind === "diarista" ? person : null, employee_id: kind === "funcionario" && person.startsWith("employee:") ? person.slice(9) : null,
        supervisor_id: kind === "funcionario" && person.startsWith("supervisor:") ? person.slice(11) : null,
        start_time: start, end_time: end, break_start: row.schedule.break_start, break_end: row.schedule.break_end, agreed_value: amount, status
      };
      const { error } = editing ? await supabase.from("coverages").update(payload).eq("id", editing.id) : await supabase.from("coverages").insert(payload);
      if (error) throw error;
    } else {
      let support_doc = editing?.support_doc ?? null;
      if (file) {
        const path = `${row.schedule.contract_id}/dispensas/${aid}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("timesheets").upload(path, file);
        if (error) throw error;
        support_doc = path;
      }
      const payload = {
        attendance_id: aid, contract_id: row.schedule.contract_id, work_date: row.schedule.work_date, kind, start_time: start, end_time: end,
        reason: reason.trim() || null, authorized_by: authorizer.trim() || null, support_doc
      };
      const { error } = editing ? await supabase.from("absence_treatments").update(payload).eq("id", editing.id) : await supabase.from("absence_treatments").insert(payload);
      if (error) throw error;
    }
  };

  const save = async () => {
    if (!start || !end || end <= start || minutes <= 0) { toast.error("Informe um período válido dentro da jornada."); return; }
    const isCoverage = kind === "diarista" || kind === "funcionario";
    if (isCoverage && !person) { toast.error("Selecione quem realizou a cobertura."); return; }
    if (kind === "dispensa" && (!reason.trim() || !authorizer.trim())) { toast.error("Informe o motivo e quem autorizou pelo tomador."); return; }
    const amount = value === "" ? suggested / 100 : Number(value.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Informe um custo válido."); return; }

    setBusy(true);
    try {
      const candidate = { id: editing?.id, start_time: start, end_time: end, break_start: row.schedule.break_start, break_end: row.schedule.break_end, status, kind };
      const { conflicts, attendanceId: aid } = await getTreatmentConflicts(row.schedule, attendance, candidate, isCoverage);

      if (conflicts.length > 0) {
        setConflictDialog({
          open: true,
          conflicts,
          execute: async () => {
            setBusy(true);
            try {
              await replaceTreatmentConflicts(conflicts);
              const attendanceId = aid ?? (await persist());
              await executeSave(attendanceId, isCoverage, amount);
              toast.success("Tratamento anterior substituído e novo registro salvo com sucesso.");
              reset();
              await refresh();
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

      const attendanceId = aid ?? (await persist());
      await executeSave(attendanceId, isCoverage, amount);
      toast.success("Tratamento registrado.");
      reset();
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (record: any, isCoverage: boolean) => {
    if (!window.confirm("Cancelar este tratamento? O histórico será preservado.")) return;
    const { error } = isCoverage ? await supabase.from("coverages").update({ status: "cancelada" }).eq("id", record.id) : await supabase.from("absence_treatments").update({ active: false }).eq("id", record.id);
    if (error) toast.error(errMsg(error)); else await refresh();
  };

  const resolveLegacy = async (conflict: LegacyConflictGroup, keepFirst: boolean) => {
    const cancelId = keepFirst ? conflict.id2 : conflict.id1;
    const isCov = keepFirst ? conflict.isCoverage2 : conflict.isCoverage1;
    const { error } = isCov
      ? await supabase.from("coverages").update({ status: "cancelada" }).eq("id", cancelId)
      : await supabase.from("absence_treatments").update({ active: false }).eq("id", cancelId);
    if (error) {
      toast.error(errMsg(error));
    } else {
      toast.success("Conflito legado resolvido com sucesso.");
      setLegacyDialog(null);
      await refresh();
    }
  };

  const proof = async (path: string) => {
    const { data, error } = await supabase.storage.from("timesheets").createSignedUrl(path, 60);
    if (error) toast.error(errMsg(error)); else if (data) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return <section className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Tratamento da ausência</h3>
      {result.pendingMin > 0 && <Pill tone="warning">Tratamento pendente: {hours(result.pendingMin)}</Pill>}
    </div>

    {/* Visual shift timeline */}
    <ShiftTimeline schedule={row.schedule} attendance={attendance} coverages={covs} treatments={treatments} />

    {/* Legacy conflicts warning and resolution */}
    {legacyConflicts.map((lc, idx) => (
      <div key={idx} className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Sobreposição herdada detectada (registro legado)
            </p>
            <p className="mt-0.5 text-foreground/85">
              Existem registros duplicados ativos nesta ausência: <strong>{lc.label1}</strong> e <strong>{lc.label2}</strong> ({hours(lc.overlapMinutes)} sobrepostos).
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setLegacyDialog(lc)}>
            Resolver duplicidade
          </Button>
        </div>
      </div>
    ))}

    <p className="text-sm">Falta: {hours(result.absentMin)} | Cobertura: {hours(result.coveredMin)} | Dispensa: {hours(result.waivedMin)} | Horas a descontar: {hours(result.uncoveredMin)} | Desconto previsto: {brl(result.discountCents)}</p>

    {[...covs.filter(c => c.status !== "cancelada").map(c => ({ ...c, isCoverage: true })), ...treatments.map(t => ({ ...t, isCoverage: false }))].map(record => <div key={record.id} className="flex items-start justify-between gap-2 border-b py-2 text-sm">
      <div className="min-w-0"><p className="font-medium">{record.isCoverage ? record.day_worker?.name ?? record.employee?.name ?? record.supervisor?.full_name : record.kind === "dispensa" ? "Dispensado pelo tomador — sem desconto" : "Sem cobertura, com desconto"}</p>
        <p>{hhmm(record.start_time)}–{hhmm(record.end_time)} {record.isCoverage && `· ${record.status === "realizada" ? "Realizada" : "Pendente"} · Custo ${brl(Math.round(Number(record.agreed_value) * 100))}`}</p>
        {record.kind === "dispensa" && <p className="text-xs text-muted-foreground">{record.reason} · Autorizado por {record.authorized_by} · {fmtDateTime(record.created_at)} · Registrado por {record.created_by}</p>}
        {record.support_doc && <Button size="sm" variant="link" onClick={() => proof(record.support_doc)}>Ver comprovante</Button>}
      </div>
      {!disabled && <div className="flex shrink-0"><Button size="icon" variant="ghost" aria-label="Editar tratamento" title="Editar tratamento" onClick={() => edit(record, record.isCoverage)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Cancelar tratamento" title="Cancelar tratamento" onClick={() => cancel(record, record.isCoverage)}><X className="h-4 w-4" /></Button></div>}
    </div>)}

    {!disabled && <div className="grid gap-3">
      {suggestion.fullyCovered && !editing && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
          ✓ Esta ausência já está 100% contemplada por tratamentos/coberturas. Caso deseje alterar, edite ou cancele um dos registros acima.
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{editing ? "Editar tratamento" : "Novo tratamento"}</span>
        {!editing && suggestion.pendingMinutes > 0 && (start !== suggestion.start || end !== suggestion.end) && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={applySuggestion}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Preencher livre ({suggestion.start}–{suggestion.end})
          </Button>
        )}
      </div>

      <Field label="Tipo do tratamento"><Select value={kind} disabled={!!editing} onValueChange={v => { setKind(v); setPerson(""); setValue(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="diarista">Cobertura por diarista</SelectItem><SelectItem value="funcionario">Cobertura por funcionário ou supervisor</SelectItem><SelectItem value="desconto">Sem cobertura, com desconto</SelectItem><SelectItem value="dispensa">Cobertura dispensada pelo tomador, sem desconto</SelectItem>
      </SelectContent></Select></Field>
      {(kind === "diarista" || kind === "funcionario") && <Field label="Quem realizou a cobertura"><Select value={person} onValueChange={setPerson}><SelectTrigger><SelectValue placeholder="Selecione uma pessoa" /></SelectTrigger><SelectContent>{kind === "diarista" ? people?.dayWorkers.map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>) : people?.company.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}</SelectContent></Select></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label="Início"><Input aria-label="Início do tratamento" type="time" value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="Fim"><Input aria-label="Fim do tratamento" type="time" value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
      <p className="text-xs text-muted-foreground">{row.schedule.work_date} · {hours(minutes)} · Intervalo da escala excluído</p>
      {(kind === "diarista" || kind === "funcionario") && <><div className="grid grid-cols-2 gap-3"><Field label="Custo adicional / valor a pagar (R$)"><Input inputMode="decimal" value={value} placeholder={(suggested / 100).toFixed(2)} onChange={e => setValue(e.target.value)} /></Field><Field label="Confirmação"><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realizada">Realizada</SelectItem><SelectItem value="planejada">Planejada</SelectItem><SelectItem value="confirmada">Confirmada, não realizada</SelectItem></SelectContent></Select></Field></div>{kind === "funcionario" && <p className="text-xs text-warning-foreground">Remanejamento: verifique o posto de origem. Trabalho simultâneo será bloqueado; registre a ausência no período remanejado.</p>}</>}
      {kind === "dispensa" && <><Field label="Motivo da dispensa (obrigatório)"><Textarea aria-label="Motivo da dispensa" value={reason} onChange={e => setReason(e.target.value)} /></Field><Field label="Quem autorizou pelo tomador (obrigatório)"><Input aria-label="Quem autorizou pelo tomador" value={authorizer} onChange={e => setAuthorizer(e.target.value)} /></Field><Field label="Comprovante (opcional)"><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field></>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={save}><Plus className="mr-1 h-4 w-4" />{busy ? "Salvando…" : editing ? "Salvar tratamento" : "Adicionar tratamento"}</Button>{editing && <Button variant="outline" onClick={reset}>Cancelar edição</Button>}</div>
    </div>}

    {/* 1-Click Conflict Replacement Confirmation Modal */}
    <AlertDialog open={!!conflictDialog?.open} onOpenChange={o => !o && setConflictDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir tratamento conflitante?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>Já existe um tratamento registrado para este período que sobrepõe o novo horário:</span>
            <span className="mt-2 block rounded-md bg-muted p-2 font-medium text-foreground">
              {conflictDialog?.conflicts.map(c => `• ${c.label} (${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)})`).join("\n")}
            </span>
            <span>Deseja substituir pelo novo? O registro anterior será inativado/cancelado no histórico e o novo período será salvo.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConflictDialog(null)}>Não, ajustar horários</AlertDialogCancel>
          <AlertDialogAction onClick={() => conflictDialog?.execute()}>Sim, substituir agora</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Legacy Duplicate Resolution Modal */}
    <AlertDialog open={!!legacyDialog} onOpenChange={o => !o && setLegacyDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolver duplicidade de registros legados</AlertDialogTitle>
          <AlertDialogDescription>
            Qual dos registros deseja manter ativo nesta data? O registro alternativo será cancelado/inativado preservando o histórico de auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Button className="w-full justify-start text-left h-auto py-2.5" variant="outline" onClick={() => legacyDialog && resolveLegacy(legacyDialog, true)}>
            <div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Manter: {legacyDialog?.label1} ({legacyDialog?.time1})</p>
              <p className="text-xs text-muted-foreground">Cancelar {legacyDialog?.label2}</p>
            </div>
          </Button>
          <Button className="w-full justify-start text-left h-auto py-2.5" variant="outline" onClick={() => legacyDialog && resolveLegacy(legacyDialog, false)}>
            <div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Manter: {legacyDialog?.label2} ({legacyDialog?.time2})</p>
              <p className="text-xs text-muted-foreground">Cancelar {legacyDialog?.label1}</p>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setLegacyDialog(null)}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}