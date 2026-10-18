import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { loadPeriod, type DayRow } from "@/lib/data";
import { ATT_LABEL, COV_LABEL, brl, brlValue, fmtDate, hhmm, hours } from "@/lib/format";
import { exportCSV, exportPDF, type ExportCol } from "@/lib/export";
import { useContracts } from "@/hooks/use-auth";
import { ContractSelect, DataTable, PageHeader, Stat, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Portal do Supervisor" }, { name: "description", content: "Relatórios de faltas, coberturas e descontos com exportação CSV e PDF." }] }),
  component: Relatorios,
});

type Kind = "faltas" | "coberturas" | "dispensas" | "funcionarios" | "diario";
const KINDS: Record<Kind, string> = { faltas: "Faltas e descontos", coberturas: "Coberturas realizadas", dispensas: "Dispensas pelo tomador", funcionarios: "Resumo por funcionário", diario: "Conferência diária completa" };

function Relatorios() {
  const [contract, setContract] = useDefaultContract();
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-31");
  const [kind, setKind] = useState<Kind>("faltas");
  const { data: contracts } = useContracts();
  const c = contracts?.find((x) => x.id === contract);
  const { data } = useQuery({ queryKey: ["period", contract, from, to], queryFn: () => loadPeriod(contract, from, to), enabled: !!contract });

  const { rows, cols } = useMemo((): { rows: any[]; cols: ExportCol[] } => {
    const all = data?.rows ?? [];
    const emp = (r: DayRow) => `${r.employee?.registration} — ${r.employee?.name}`;
    if (kind === "faltas") return {
      rows: all.filter((r) => r.result.needMin > 0),
      cols: [
        { header: "Data", value: (r) => fmtDate(r.schedule.work_date) }, { header: "Posto", value: (r) => r.post?.code },
        { header: "Funcionário", value: emp }, { header: "Situação", value: (r) => ATT_LABEL[r.attendance?.status] ?? "" },
        { header: "Ausência", value: (r) => hours(r.result.absentMin) }, { header: "Coberto", value: (r) => hours(r.result.coveredMin) },
        { header: "Dispensado sem desconto", value: (r) => hours(r.result.waivedMin) }, { header: "Tratamento pendente", value: (r) => hours(r.result.pendingMin) },
        { header: "Descoberto", value: (r) => hours(r.result.uncoveredMin) }, { header: "Desconto", value: (r) => brl(r.result.discountCents) },
      ],
    };
    if (kind === "coberturas") return {
      rows: (data?.coverages ?? []).filter((x: any) => x.status === "realizada"),
      cols: [
        { header: "Data", value: (x) => fmtDate(x.work_date) }, { header: "Posto", value: (x) => x.post?.code },
        { header: "Cobridor", value: (x) => x.day_worker?.name ?? x.employee?.name ?? x.supervisor?.full_name ?? "" },
        { header: "Tipo", value: (x) => x.day_worker_id ? "Diarista" : x.supervisor_id ? "Supervisor" : "Funcionário" },
        { header: "Horário", value: (x) => `${hhmm(x.start_time)}–${hhmm(x.end_time)}` },
        { header: "Situação", value: (x) => COV_LABEL[x.status] ?? x.status }, { header: "Pagamento", value: (x) => x.payment_status === "pago" ? "Pago" : "Pendente" },
        { header: "Valor", value: (x) => brlValue(x.agreed_value) },
      ],
    };
    if (kind === "dispensas") return {
      rows: (data?.treatments ?? []).filter(t => t.active && t.kind === "dispensa"),
      cols: [
        { header: "Data", value: t => fmtDate(t.work_date) },
        { header: "Funcionário", value: t => { const r = all.find(r => r.attendance?.id === t.attendance_id); return r ? emp(r) : ""; } },
        { header: "Situação", value: () => "Dispensado pelo tomador — sem desconto" },
        { header: "Período autorizado", value: t => `${hhmm(t.start_time)}–${hhmm(t.end_time)}` },
        { header: "Motivo", value: t => t.reason }, { header: "Autorizado por", value: t => t.authorized_by },
        { header: "Registrado por", value: t => t.created_by }, { header: "Registro", value: t => t.created_at },
      ],
    };
    if (kind === "funcionarios") {
      const m = new Map<string, any>();
      for (const r of all) {
        const k = r.employee?.id ?? r.schedule.employee_id;
        const e = m.get(k) ?? { id: k, name: emp(r), days: 0, integral: 0, partial: 0, absent: 0, covered: 0, waived: 0, pending: 0, uncovered: 0, discount: 0 };
        e.days++;
        if (r.attendance?.status === "falta_integral") e.integral++;
        if (r.attendance?.status === "falta_parcial") e.partial++;
        e.absent += r.result.absentMin; e.uncovered += r.result.uncoveredMin; e.discount += r.result.discountCents;
        e.covered += r.result.coveredMin; e.waived += r.result.waivedMin; e.pending += r.result.pendingMin;
        m.set(k, e);
      }
      return {
        rows: [...m.values()].sort((a, b) => b.discount - a.discount),
        cols: [
          { header: "Funcionário", value: (e) => e.name }, { header: "Dias escalados", value: (e) => e.days },
          { header: "Faltas integrais", value: (e) => e.integral }, { header: "Faltas parciais", value: (e) => e.partial },
          { header: "Ausência", value: (e) => hours(e.absent) }, { header: "Descoberto", value: (e) => hours(e.uncovered) }, { header: "Desconto", value: (e) => brl(e.discount) },
          { header: "Coberto", value: e => hours(e.covered) }, { header: "Dispensado sem desconto", value: e => hours(e.waived) }, { header: "Tratamento pendente", value: e => hours(e.pending) },
        ],
      };
    }
    return {
      rows: all,
      cols: [
        { header: "Data", value: (r) => fmtDate(r.schedule.work_date) }, { header: "Posto", value: (r) => r.post?.code },
        { header: "Funcionário", value: emp }, { header: "Turno", value: (r) => `${hhmm(r.schedule.start_time)}–${hhmm(r.schedule.end_time)}` },
        { header: "Situação", value: (r) => r.attendance ? ATT_LABEL[r.attendance.status] ?? "" : "Não informado" },
        { header: "Descoberto", value: (r) => hours(r.result.uncoveredMin) }, { header: "Desconto", value: (r) => brl(r.result.discountCents) },
        { header: "Ausência", value: r => hours(r.result.absentMin) }, { header: "Horas cobertas", value: r => hours(r.result.coveredMin) }, { header: "Dispensado sem desconto", value: r => hours(r.result.waivedMin) }, { header: "Tratamento pendente", value: r => hours(r.result.pendingMin) },
        { header: "Cobertura", value: (r) => brl(r.result.coverageCostCents) },
      ],
    };
  }, [data, kind]);

  const t = data?.totals;
  const name = `${KINDS[kind]} ${c?.code ?? ""}`;
  const subtitle = `${c?.code} — ${c?.name} · ${fmtDate(from)} a ${fmtDate(to)}${data?.provisional ? " · VALORES PROVISÓRIOS" : ""} · Desconto ${brl(t?.discountCents ?? 0)} · Coberturas ${brl(t?.coverageCostCents ?? 0)} · Impacto ${brl(t?.impactCents ?? 0)}`;

  return (
    <div>
      <PageHeader title="Relatórios" description="Todos os valores vêm do mesmo motor de cálculo usado nas demais telas."
        actions={<>
          <Button variant="outline" disabled={!rows.length} onClick={() => exportCSV(`${name}_${from}_${to}`.replace(/\s+/g, "_"), cols, rows)}>Exportar CSV</Button>
          <Button disabled={!rows.length} onClick={() => exportPDF(name, subtitle, cols, rows)}>Exportar PDF</Button>
        </>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      {data?.provisional && <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">Valores provisórios: {data.notInformed} presença(s) não informada(s), {hours(data.totals.pendingMin)} com tratamento pendente e {data.openCalcDivergences} divergência(s) aberta(s).</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Desconto previsto" value={brl(t?.discountCents ?? 0)} tone="danger" />
        <Stat label="Custo de coberturas" value={brl(t?.coverageCostCents ?? 0)} tone="info" />
        <Stat label="Impacto total" value={brl(t?.impactCents ?? 0)} tone="warning" />
        <Stat label="Horas cobertas" value={hours(t?.coveredMin ?? 0)} tone="success" />
        <Stat label="Dispensa sem desconto" value={hours(t?.waivedMin ?? 0)} tone="info" />
        <Stat label="Tratamento pendente" value={hours(t?.pendingMin ?? 0)} tone="warning" />
      </div>
      <DataTable rows={rows} rowKey={(r: any) => r.schedule?.id ?? r.id} search={(r: any) => cols.map((x) => x.value(r)).join(" ")}
        cols={cols.map((x) => ({ header: x.header, cell: (r: any) => x.value(r) }))} />
    </div>
  );
}
