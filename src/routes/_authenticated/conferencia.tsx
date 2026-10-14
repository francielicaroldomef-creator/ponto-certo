import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Paperclip, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadPeriod, errMsg, type DayRow } from "@/lib/data";
import { ATT_LABEL, JUST_LABEL, brl, fmtDate, hhmm, hours } from "@/lib/format";
import { minToHHMM, toMin, workIntervals, intersect, total, type Interval } from "@/lib/calc";
import { ContractSelect, DataTable, Field, PageHeader, Pill, Stat, attTone, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/conferencia")({
  head: () => ({ meta: [{ title: "Conferência diária — Portal do Supervisor" }] }),
  component: Conferencia,
});

function Conferencia() {
  const [contract, setContract] = useDefaultContract();
  const [date, setDate] = useState("2026-10-05");
  const qc = useQueryClient();
  const key = ["period", contract, date, date];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => loadPeriod(contract, date, date), enabled: !!contract });
  const [edit, setEdit] = useState<DayRow | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["period"] });

  const quick = async (r: DayRow, status: string) => {
    const { error } = await supabase.from("attendance").upsert(
      { schedule_id: r.schedule.id, contract_id: r.schedule.contract_id, work_date: r.schedule.work_date, status, absent_intervals: [] },
      { onConflict: "schedule_id" },
    );
    if (error) toast.error(errMsg(error));
    else refresh();
  };

  const pending = useMemo(() => (data?.rows ?? []).filter((r) => !r.attendance), [data]);
  const batch = async () => {
    const rows = pending.map((r) => ({ schedule_id: r.schedule.id, contract_id: r.schedule.contract_id, work_date: r.schedule.work_date, status: "presente" }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "schedule_id", ignoreDuplicates: true });
    setBatchOpen(false);
    if (error) toast.error(errMsg(error));
    else { toast.success(`${rows.length} registro(s) marcados como Presente.`); refresh(); }
  };

  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Conferência diária" description="Registre a situação de cada pessoa prevista na escala."
        actions={<Button disabled={!pending.length} onClick={() => setBatchOpen(true)}><CheckCheck className="mr-2 h-4 w-4" />Marcar não informados como presentes</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={date} onChange={setDate} />
      </div>
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Previstos" value={data.rows.length} />
          <Stat label="Não informados" value={data.notInformed} tone={data.notInformed ? "warning" : "success"} />
          <Stat label="Faltas" value={`${t!.integral} int. / ${t!.partial} parc.`} hint={hours(t!.absentMin) + " ausentes"} tone="danger" />
          <Stat label="Horas descobertas" value={hours(t!.uncoveredMin)} hint={hours(t!.coveredMin) + " cobertas"} tone="warning" />
          <Stat label="Desconto previsto" value={brl(t!.discountCents)} hint={data.provisional ? "Provisório" : "Revisado"} tone="danger" />
          <Stat label="Custo coberturas" value={brl(t!.coverageCostCents)} hint={`Impacto: ${brl(t!.impactCents)}`} tone="info" />
        </div>
      )}
      {data?.provisional && (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
          Totais provisórios: {data.notInformed} não informado(s) e {data.openCalcDivergences} divergência(s) aberta(s) que afetam o cálculo.{" "}
          <Link to="/divergencias" className="underline">Ver divergências</Link>
        </p>
      )}
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <DataTable
          rows={data?.rows ?? []}
          rowKey={(r) => r.schedule.id}
          search={(r) => `${r.employee?.registration} ${r.employee?.name} ${r.post?.code}`}
          pageSize={40}
          empty="Nenhuma pessoa prevista na escala para esta data."
          cols={[
            { header: "Matrícula", cell: (r) => <span className="font-mono text-xs">{r.employee?.registration}</span> },
            { header: "Funcionário", cell: (r) => <div><p className="font-medium">{r.employee?.name}</p><p className="text-xs text-muted-foreground">{r.post?.code} · {hhmm(r.schedule.start_time)}–{hhmm(r.schedule.end_time)}</p></div> },
            { header: "Situação", cell: (r) => <Pill tone={attTone(r.attendance?.status)}>{r.attendance ? ATT_LABEL[r.attendance.status] : "Não informado"}</Pill> },
            { header: "Justificativa", cell: (r) => r.attendance && r.attendance.status.startsWith("falta") ? <Pill tone={r.attendance.justification_status === "aprovada" ? "success" : r.attendance.justification_status === "rejeitada" ? "danger" : "neutral"}>{JUST_LABEL[r.attendance.justification_status]}</Pill> : "—" },
            { header: "Descoberto", cell: (r) => r.result.needMin ? <span className="num">{hours(r.result.uncoveredMin)}{r.result.coveredMin > 0 && <span className="text-xs text-muted-foreground"> ({hours(r.result.coveredMin)} cob.)</span>}</span> : "—" },
            { header: "Desconto", cell: (r) => <span className="num">{r.result.discountCents ? brl(r.result.discountCents) : "—"}</span> },
            { header: "Alertas", cell: (r) => r.divergences.filter((d) => d.status === "aberta").length ? <Pill tone="warning">Divergência</Pill> : null },
            { header: "Ações", cell: (r) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => quick(r, "presente")}>Presente</Button>
                <Button size="sm" variant="outline" onClick={() => quick(r, "falta_integral")}>Falta</Button>
                <Button size="sm" onClick={() => setEdit(r)}>Detalhar</Button>
              </div>
            ) },
          ]}
        />
      )}
      {edit && <EditDialog row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
      <AlertDialog open={batchOpen} onOpenChange={setBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preenchimento em lote</AlertDialogTitle>
            <AlertDialogDescription>{pending.length} pessoa(s) ainda estão como “Não informado” em {fmtDate(date)}. Confirmar todas como Presente? Registros já preenchidos não serão alterados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={batch}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({ row, onClose, onSaved }: { row: DayRow; onClose: () => void; onSaved: () => void }) {
  const a = row.attendance;
  const [status, setStatus] = useState<string>(a?.status ?? "presente");
  const [intervals, setIntervals] = useState<{ start: string; end: string }[]>(a?.absent_intervals?.length ? a.absent_intervals : [{ start: "13:00", end: "17:00" }]);
  const [just, setJust] = useState<string>(a?.justification_status ?? "nao_apresentada");
  const [notes, setNotes] = useState<string>(a?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const s = row.schedule;
  const work = workIntervals(s.start_time, s.end_time, s.break_start, s.break_end);
  const partialMin = total(intersect(intervals.filter((i) => i.start && i.end).map((i) => [toMin(i.start)!, toMin(i.end)!] as Interval), work));

  const save = async () => {
    setBusy(true);
    try {
      let justification_doc = a?.justification_doc ?? null;
      if (file) {
        const path = `${s.contract_id}/justificativas/${s.id}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("timesheets").upload(path, file);
        if (error) throw error;
        justification_doc = path;
        if (just === "nao_apresentada") setJust("pendente");
      }
      const { error } = await supabase.from("attendance").upsert({
        schedule_id: s.id, contract_id: s.contract_id, work_date: s.work_date, status,
        absent_intervals: status === "falta_parcial" ? intervals : [],
        justification_status: file && just === "nao_apresentada" ? "pendente" : just,
        justification_doc, notes,
      }, { onConflict: "schedule_id" });
      if (error) throw error;
      toast.success("Registro salvo.");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row.employee?.registration} — {row.employee?.name}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{fmtDate(s.work_date)} · Posto {row.post?.code} · {hhmm(s.start_time)}–{hhmm(s.end_time)} (intervalo {hhmm(s.break_start)}–{hhmm(s.break_end)})</p>
        <div className="grid gap-4">
          <Field label="Situação do funcionário">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(ATT_LABEL).map(([k, v]) => (
                <Button key={k} type="button" size="sm" variant={status === k ? "default" : "outline"} onClick={() => setStatus(k)}>{v}</Button>
              ))}
            </div>
          </Field>
          {status === "falta_parcial" && (
            <Field label="Intervalos não trabalhados">
              <div className="space-y-2">
                {intervals.map((iv, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" value={iv.start} onChange={(e) => setIntervals(intervals.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                    <span>até</span>
                    <Input type="time" value={iv.end} onChange={(e) => setIntervals(intervals.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setIntervals(intervals.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setIntervals([...intervals, { start: "", end: "" }])}><Plus className="mr-1 h-4 w-4" />Intervalo</Button>
                <p className="text-xs text-muted-foreground">Duração (sem almoço): {partialMin} min = {minToHHMM(partialMin)} h</p>
              </div>
            </Field>
          )}
          {(status === "falta_integral" || status === "falta_parcial") && (
            <Field label="Justificativa (independente do desconto)">
              <Select value={just} onValueChange={setJust}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(JUST_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {["folga", "ferias", "afastamento"].includes(status) && (
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Não gera falta do funcionário. {status === "folga" ? "Folga não gera necessidade de cobertura." : "O posto continua exigido pelo contrato: horas sem cobertura geram desconto."}</p>
          )}
          <Field label="Documento anexo (opcional)">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {a?.justification_doc && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" />Documento já anexado</span>}
          </Field>
          <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
