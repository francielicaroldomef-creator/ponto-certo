import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, type DayRow } from "@/lib/data";
import { validateTreatmentConflict } from "@/lib/treatment-conflicts";
import { computePostDay, coverageIntervals, total, suggestCoverageCents, type AttendanceLike } from "@/lib/calc";
import { brl, hours, hhmm, fmtDateTime } from "@/lib/format";
import { Field, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const refresh = async () => { await qc.invalidateQueries({ queryKey: key }); await qc.invalidateQueries({ queryKey: ["period"] }); };
  const reset = () => { setEditing(null); setPerson(""); setValue(""); setReason(""); setAuthorizer(""); setFile(null); };
  const edit = (record: any, isCoverage: boolean) => {
    setEditing({ ...record, isCoverage }); setKind(isCoverage ? record.coverer_type : record.kind);
    setStart(record.start_time.slice(0, 5)); setEnd(record.end_time.slice(0, 5));
    setPerson(record.day_worker_id ?? (record.employee_id ? `employee:${record.employee_id}` : record.supervisor_id ? `supervisor:${record.supervisor_id}` : ""));
    setValue(String(record.agreed_value ?? "")); setStatus(record.status ?? "realizada"); setReason(record.reason ?? ""); setAuthorizer(record.authorized_by ?? "");
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
      await validateTreatmentConflict(row.schedule, attendance, { id: editing?.id, start_time: start, end_time: end, break_start: row.schedule.break_start, break_end: row.schedule.break_end, status, kind }, isCoverage);
      const attendanceId = await persist();
      if (isCoverage) {
        const payload = { contract_id: row.schedule.contract_id, post_id: row.schedule.post_id, attendance_id: attendanceId, work_date: row.schedule.work_date, coverer_type: kind,
          day_worker_id: kind === "diarista" ? person : null, employee_id: kind === "funcionario" && person.startsWith("employee:") ? person.slice(9) : null,
          supervisor_id: kind === "funcionario" && person.startsWith("supervisor:") ? person.slice(11) : null,
          start_time: start, end_time: end, break_start: row.schedule.break_start, break_end: row.schedule.break_end, agreed_value: amount, status };
        const { error } = editing ? await supabase.from("coverages").update(payload).eq("id", editing.id) : await supabase.from("coverages").insert(payload);
        if (error) throw error;
      } else {
        let support_doc = editing?.support_doc ?? null;
        if (file) {
          const path = `${row.schedule.contract_id}/dispensas/${attendanceId}-${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from("timesheets").upload(path, file);
          if (error) throw error; support_doc = path;
        }
        const payload = { attendance_id: attendanceId, contract_id: row.schedule.contract_id, work_date: row.schedule.work_date, kind, start_time: start, end_time: end, reason: reason.trim() || null, authorized_by: authorizer.trim() || null, support_doc };
        const { error } = editing ? await supabase.from("absence_treatments").update(payload).eq("id", editing.id) : await supabase.from("absence_treatments").insert(payload);
        if (error) throw error;
      }
      toast.success("Tratamento registrado."); reset(); await refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const cancel = async (record: any, isCoverage: boolean) => {
    if (!window.confirm("Cancelar este tratamento? O histórico será preservado.")) return;
    const { error } = isCoverage ? await supabase.from("coverages").update({ status: "cancelada" }).eq("id", record.id) : await supabase.from("absence_treatments").update({ active: false }).eq("id", record.id);
    if (error) toast.error(errMsg(error)); else await refresh();
  };
  const proof = async (path: string) => {
    const { data, error } = await supabase.storage.from("timesheets").createSignedUrl(path, 60);
    if (error) toast.error(errMsg(error)); else if (data) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return <section className="space-y-3 border-t pt-4">
    <h3 className="font-semibold">Tratamento da ausência</h3>
    <p className="text-sm">Falta: {hours(result.absentMin)} | Cobertura: {hours(result.coveredMin)} | Dispensa: {hours(result.waivedMin)} | Horas a descontar: {hours(result.uncoveredMin)} | Desconto previsto: {brl(result.discountCents)}</p>
    {result.pendingMin > 0 && <Pill tone="warning">Tratamento pendente: {hours(result.pendingMin)}</Pill>}
    {[...covs.filter(c => c.status !== "cancelada").map(c => ({ ...c, isCoverage: true })), ...treatments.map(t => ({ ...t, isCoverage: false }))].map(record => <div key={record.id} className="flex items-start justify-between gap-2 border-b py-2 text-sm">
      <div className="min-w-0"><p className="font-medium">{record.isCoverage ? record.day_worker?.name ?? record.employee?.name ?? record.supervisor?.full_name : record.kind === "dispensa" ? "Dispensado pelo tomador — sem desconto" : "Sem cobertura, com desconto"}</p>
        <p>{hhmm(record.start_time)}–{hhmm(record.end_time)} {record.isCoverage && `· ${record.status === "realizada" ? "Realizada" : "Pendente"} · Custo ${brl(Math.round(Number(record.agreed_value) * 100))}`}</p>
        {record.kind === "dispensa" && <p className="text-xs text-muted-foreground">{record.reason} · Autorizado por {record.authorized_by} · {fmtDateTime(record.created_at)} · Registrado por {record.created_by}</p>}
        {record.support_doc && <Button size="sm" variant="link" onClick={() => proof(record.support_doc)}>Ver comprovante</Button>}
      </div>
      {!disabled && <div className="flex shrink-0"><Button size="icon" variant="ghost" aria-label="Editar tratamento" title="Editar tratamento" onClick={() => edit(record, record.isCoverage)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Cancelar tratamento" title="Cancelar tratamento" onClick={() => cancel(record, record.isCoverage)}><X className="h-4 w-4" /></Button></div>}
    </div>)}
    {!disabled && <div className="grid gap-3">
      <Field label={editing ? "Editar tratamento" : "Novo tratamento"}><Select value={kind} disabled={!!editing} onValueChange={v => { setKind(v); setPerson(""); setValue(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="diarista">Cobertura por diarista</SelectItem><SelectItem value="funcionario">Cobertura por funcionário ou supervisor</SelectItem><SelectItem value="desconto">Sem cobertura, com desconto</SelectItem><SelectItem value="dispensa">Cobertura dispensada pelo tomador, sem desconto</SelectItem>
      </SelectContent></Select></Field>
      {(kind === "diarista" || kind === "funcionario") && <Field label="Quem realizou a cobertura"><Select value={person} onValueChange={setPerson}><SelectTrigger><SelectValue placeholder="Selecione uma pessoa" /></SelectTrigger><SelectContent>{kind === "diarista" ? people?.dayWorkers.map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>) : people?.company.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}</SelectContent></Select></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label="Início"><Input aria-label="Início do tratamento" type="time" value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="Fim"><Input aria-label="Fim do tratamento" type="time" value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
      <p className="text-xs text-muted-foreground">{row.schedule.work_date} · {hours(minutes)} · Intervalo da escala excluído</p>
      {(kind === "diarista" || kind === "funcionario") && <><div className="grid grid-cols-2 gap-3"><Field label="Custo adicional / valor a pagar (R$)"><Input inputMode="decimal" value={value} placeholder={(suggested / 100).toFixed(2)} onChange={e => setValue(e.target.value)} /></Field><Field label="Confirmação"><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realizada">Realizada</SelectItem><SelectItem value="planejada">Planejada</SelectItem><SelectItem value="confirmada">Confirmada, não realizada</SelectItem></SelectContent></Select></Field></div>{kind === "funcionario" && <p className="text-xs text-warning-foreground">Remanejamento: verifique o posto de origem. Trabalho simultâneo será bloqueado; registre a ausência no período remanejado.</p>}</>}
      {kind === "dispensa" && <><Field label="Motivo da dispensa (obrigatório)"><Textarea aria-label="Motivo da dispensa" value={reason} onChange={e => setReason(e.target.value)} /></Field><Field label="Quem autorizou pelo tomador (obrigatório)"><Input aria-label="Quem autorizou pelo tomador" value={authorizer} onChange={e => setAuthorizer(e.target.value)} /></Field><Field label="Comprovante (opcional)"><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field></>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={save}><Plus className="mr-1 h-4 w-4" />{busy ? "Salvando…" : editing ? "Salvar tratamento" : "Adicionar tratamento"}</Button>{editing && <Button variant="outline" onClick={reset}>Cancelar edição</Button>}</div>
    </div>}
  </section>;
}