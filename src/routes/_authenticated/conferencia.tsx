import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadPeriod, errMsg, type DayRow } from "@/lib/data";
import { ATT_LABEL, JUST_LABEL, brl, fmtDate, hhmm, hours, todaySP } from "@/lib/format";
import { minToHHMM, toMin, workIntervals, intersect, total, type Interval } from "@/lib/calc";
import { ContractSelect, DataTable, Field, PageHeader, Pill, Stat, attTone, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AbsenceTreatment } from "@/components/absence-treatment";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/conferencia")({
  head: () => ({ meta: [{ title: "Conferência diária — Portal do Supervisor" }] }),
  component: Conferencia,
});

function Conferencia() {
  const [contract, setContract] = useDefaultContract();
  const [date, setDate] = useState(todaySP());
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: closed } = useQuery({
    queryKey: ["period-locked", contract, date],
    enabled: !!contract,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_period_closed", { _contract: contract, _d: date });
      if (error) throw error;
      return data;
    },
  });
  const canEdit = !!me?.has("admin", "supervisor", "conferente") && closed === false;
  const isFinancial = !!me?.has("admin", "financeiro");
  const key = ["period", contract, date, date, me?.roles?.join(",")];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => loadPeriod(contract, date, date, me?.roles),
    enabled: !!contract,
  });
  const [edit, setEdit] = useState<DayRow | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["period"] });

  const quick = async (r: DayRow, status: string) => {
    const { error } = await supabase.from("attendance").upsert(
      {
        schedule_id: r.schedule.id,
        contract_id: r.schedule.contract_id,
        work_date: r.schedule.work_date,
        status,
        absent_intervals: [],
        hour_value: r.attendance?.hour_value ?? r.post?.hour_value ?? null,
      },
      { onConflict: "schedule_id" },
    );
    if (error) toast.error(errMsg(error));
    else refresh();
  };

  const t = data?.totals;
  return (
    <div>
      <PageHeader
        title="Conferência diária"
        description="Registre a situação de cada pessoa prevista na escala."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={date} onChange={setDate} />
      </div>
      {closed && <p className="mb-4 text-sm text-muted-foreground">Período fechado — somente consulta.</p>}
      {data && t && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Previstos" value={data.rows.length} />
          <Stat label="Não informados" value={data.notInformed} tone={data.notInformed ? "warning" : "success"} />
          <Stat label="Faltas" value={`${t.integral} int. / ${t.partial} parc.`} hint={hours(t.absentMin) + " ausentes"} tone="danger" />
          <Stat label="Horas a descontar" value={hours(t.uncoveredMin)} hint={hours(t.coveredMin) + " cobertas"} tone="warning" />
          <Stat label="Dispensa sem desconto" value={hours(t.waivedMin)} tone="info" />
          <Stat label="Tratamento pendente" value={hours(t.pendingMin)} tone={t.pendingMin ? "warning" : "success"} />
          {isFinancial ? (
            <>
              <Stat label="Desconto previsto" value={brl(t.discountCents)} hint={data.provisional ? "Provisório" : "Revisado"} tone="danger" />
              <Stat label="Custo coberturas" value={brl(t.coverageCostCents)} hint={`Impacto: ${brl(t.impactCents)}`} tone="info" />
            </>
          ) : (
            <Stat label="Financeiro" value="Restrito" hint="Requer perfil Financeiro/Admin" tone="neutral" />
          )}
        </div>
      )}
      {data?.provisional && (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
          Totais provisórios: {data.notInformed} não informado(s), {hours(data.totals.pendingMin)} com tratamento pendente e {data.openCalcDivergences} divergência(s) aberta(s).{" "}
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
            {
              header: "Funcionário",
              className: "whitespace-normal align-top",
              cell: (r) => (
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">{r.employee?.registration}</span>{" "}
                    {r.employee?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.post?.code} · {hhmm(r.schedule.start_time)}–{hhmm(r.schedule.end_time)}
                  </p>
                  {r.result.needMin > 0 && (
                    <>
                      <p className="mt-1 text-xs">
                        Falta: {hours(r.result.absentMin)} | Cobertura: {hours(r.result.coveredMin)} | Dispensa: {hours(r.result.waivedMin)} | A descontar: {hours(r.result.uncoveredMin)}
                      </p>
                      {isFinancial && (
                        <p className="text-xs text-muted-foreground">
                          Ausência {brl(Math.round(r.result.absentMin * r.unitCentsPerMin))} · abat. cobertura {brl(Math.round(r.result.coveredMin * r.unitCentsPerMin))} · abat. dispensa {brl(Math.round(r.result.waivedMin * r.unitCentsPerMin))} · desconto final {brl(r.result.discountCents)} · custo cobertura {brl(r.result.coverageCostCents)}
                        </p>
                      )}
                      {r.coverages.filter(c => c.status !== "cancelada").map(c => (
                        <p key={c.id} className="text-xs text-muted-foreground">
                          Cobertura: {c.day_worker?.name ?? c.employee?.name ?? c.supervisor?.full_name} · {hhmm(c.start_time)}–{hhmm(c.end_time)}{isFinancial && c.agreed_value ? ` · custo ${brl(Math.round(Number(c.agreed_value) * 100))}` : ""}
                        </p>
                      ))}
                      {r.result.waivedMin > 0 && <p className="text-xs text-info">Dispensado pelo tomador — sem desconto</p>}
                      {r.result.pendingMin > 0 && <Pill tone="warning">Tratamento pendente</Pill>}
                    </>
                  )}
                </div>
              ),
            },
            {
              header: "Situação",
              className: "whitespace-normal align-top",
              cell: (r) => (
                <div className="flex flex-wrap gap-1">
                  <Pill tone={attTone(r.attendance?.status)}>
                    {r.attendance ? ATT_LABEL[r.attendance.status] : "Não informado"}
                  </Pill>
                  {r.attendance?.status?.startsWith("falta") && (
                    <Pill tone={r.attendance.justification_status === "aprovada" ? "success" : r.attendance.justification_status === "rejeitada" ? "danger" : "neutral"}>
                      {JUST_LABEL[r.attendance.justification_status]}
                    </Pill>
                  )}
                  {r.divergences.filter((d) => d.status === "aberta").length > 0 && <Pill tone="warning">Divergência</Pill>}
                </div>
              ),
            },
            {
              header: "Desconto cliente",
              className: "whitespace-normal align-top",
              cell: (r) => <span className="num">{isFinancial ? (r.result.discountCents ? brl(r.result.discountCents) : "—") : "🔒 Restrito"}</span>,
            },
            {
              header: "Ações",
              className: "whitespace-normal align-top",
              cell: (r) => (
                <div className="flex flex-wrap gap-1">
                  <Button disabled={!canEdit} size="sm" variant="outline" onClick={() => quick(r, "presente")}>
                    Presente
                  </Button>
                  <Button
                    disabled={!canEdit}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const { error } = await supabase.from("attendance").upsert(
                        { schedule_id: r.schedule.id, contract_id: r.schedule.contract_id, work_date: r.schedule.work_date, status: "falta_integral", absent_intervals: [] },
                        { onConflict: "schedule_id" },
                      );
                      if (error) toast.error(errMsg(error));
                      else { await refresh(); setEdit({ ...r, attendance: { ...r.attendance, status: "falta_integral", absent_intervals: [] } }); }
                    }}
                  >
                    Falta
                  </Button>
                  <Button size="sm" onClick={() => setEdit(r)}>
                    {r.attendance?.status?.startsWith("falta") ? "Cobertura" : "Detalhar"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
      {edit && (
        <EditDialog
          row={edit}
          disabled={!canEdit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); refresh(); }}
        />
      )}
    </div>
  );
}

function EditDialog({ row, onClose, onSaved, disabled }: { row: DayRow; onClose: () => void; onSaved: () => void; disabled: boolean }) {
  const a = row.attendance;
  const [status, setStatus] = useState<string>(a?.status ?? "presente");
  const [intervals, setIntervals] = useState<{ start: string; end: string }[]>(a?.absent_intervals?.length ? a.absent_intervals : [{ start: "13:00", end: "17:00" }]);
  const [just, setJust] = useState<string>(a?.justification_status ?? "nao_apresentada");
  const [notes, setNotes] = useState<string>(a?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const s = row.schedule;
  const work = workIntervals(s.start_time, s.end_time, s.break_start, s.break_end);
  const partialMin = total(intersect(intervals.flatMap(i => { const start = toMin(i.start), end = toMin(i.end); return start === null || end === null ? [] : [[start, end] as Interval]; }), work));

  const persist = async () => {
    if (disabled) throw new Error("Período fechado ou sem permissão.");
    if (status === "falta_parcial" && (!partialMin || intervals.some(i => !i.start || !i.end || i.end <= i.start))) throw new Error("Informe intervalos de ausência válidos.");
    let justification_doc = a?.justification_doc ?? null;
    if (file) {
      const path = `${s.contract_id}/justificativas/${s.id}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("timesheets").upload(path, file);
      if (error) throw error;
      justification_doc = path;
      if (just === "nao_apresentada") setJust("pendente");
    }
    const { data: saved, error } = await supabase.from("attendance").upsert({
      schedule_id: s.id, contract_id: s.contract_id, work_date: s.work_date, status,
      absent_intervals: status === "falta_parcial" ? intervals : [],
      justification_status: file && just === "nao_apresentada" ? "pendente" : just,
      justification_doc, notes, hour_value: a?.hour_value ?? row.post?.hour_value ?? null,
    }, { onConflict: "schedule_id" }).select("id").single();
    if (error) throw error;
    if (!saved) throw new Error("Não foi possível salvar a ocorrência.");
    return saved.id;
  };

  const save = async () => {
    setBusy(true);
    try {
      await persist();
      toast.success("Registro salvo.");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{row.employee?.registration} — {row.employee?.name}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          {fmtDate(s.work_date)} · Posto {row.post?.code} · {hhmm(s.start_time)}–{hhmm(s.end_time)} (intervalo {hhmm(s.break_start)}–{hhmm(s.break_end)})
        </p>
        <div className="grid gap-4">
          <fieldset disabled={disabled || busy} className="grid gap-4">
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
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                Não gera falta do funcionário. {status === "folga" ? "Folga não gera necessidade de cobertura." : "O posto continua exigido pelo contrato: horas sem cobertura geram desconto."}
              </p>
            )}
            <Field label="Documento anexo (opcional)">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {a?.justification_doc && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" />Documento já anexado</span>}
            </Field>
            <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </fieldset>
          {["falta_integral", "falta_parcial", "ferias", "afastamento"].includes(status) && (
            <AbsenceTreatment
              row={row}
              attendance={{ status: status as import("@/lib/calc").AttendanceStatus, absent_intervals: intervals }}
              persist={persist}
              disabled={disabled || busy}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy || disabled}>{busy ? "Salvando…" : "Salvar ocorrência"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
