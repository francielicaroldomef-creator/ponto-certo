import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { loadPeriod } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { exportCSV } from "@/lib/export";
import { useContracts } from "@/hooks/use-auth";
import { useDefaultPeriod } from "@/hooks/use-period";
import { ContractSelect, DataTable, PageHeader, Pill, Stat, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/efetivo")({
  head: () => ({ meta: [{ title: "Conferência do efetivo — Portal do Supervisor" }, { name: "description", content: "Efetivo contratado x efetivo presente por dia." }] }),
  component: Efetivo,
});

interface DayEff { date: string; scheduled: number; present: number; partial: number; absent: number; covered: number; effective: number; required: number; gap: number; informed: boolean }

function Efetivo() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const { data: contracts } = useContracts();
  const c = contracts?.find((x) => x.id === contract);
  const { data } = useQuery({ queryKey: ["period", contract, from, to], queryFn: () => loadPeriod(contract, from, to), enabled: !!contract });

  const days = useMemo<DayEff[]>(() => {
    const m = new Map<string, DayEff>();
    for (const r of data?.rows ?? []) {
      const d = r.schedule.work_date as string;
      const e = m.get(d) ?? { date: d, scheduled: 0, present: 0, partial: 0, absent: 0, covered: 0, effective: 0, required: c?.required_headcount ?? 0, gap: 0, informed: true };
      const st = r.attendance?.status;
      if (st === "folga") { m.set(d, e); continue; }
      e.scheduled++;
      if (!r.attendance) e.informed = false;
      if (st === "presente") e.present++;
      else if (st === "falta_parcial") e.partial++;
      else if (st) e.absent++;
      // a post counts as filled if the person worked or the whole need was covered
      const filled = st === "presente" || (r.result.needMin > 0 && r.result.coveredMin === r.result.needMin);
      if (filled && st !== "presente" && st !== "falta_parcial") e.covered++;
      if (filled) e.effective++;
      m.set(d, e);
    }
    return [...m.values()].map((e) => ({ ...e, gap: Math.max(0, e.required - e.effective) })).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, c]);

  const gapDays = days.filter((d) => d.gap > 0).length;
  const avg = days.length ? days.reduce((a, d) => a + d.effective, 0) / days.length : 0;

  return (
    <div>
      <PageHeader title="Conferência do efetivo" description="Compara o efetivo contratado com o efetivo efetivamente atendido (presentes + coberturas realizadas)."
        actions={<Button variant="outline" onClick={() => exportCSV(`efetivo_${c?.code}_${from}_${to}`, [
          { header: "Data", value: (d: DayEff) => fmtDate(d.date) }, { header: "Contratado", value: (d: DayEff) => d.required },
          { header: "Escalados", value: (d: DayEff) => d.scheduled }, { header: "Presentes", value: (d: DayEff) => d.present },
          { header: "Falta parcial", value: (d: DayEff) => d.partial }, { header: "Ausentes", value: (d: DayEff) => d.absent },
          { header: "Cobertos", value: (d: DayEff) => d.covered }, { header: "Efetivo", value: (d: DayEff) => d.effective }, { header: "Déficit", value: (d: DayEff) => d.gap },
        ], days)}>Exportar CSV</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Efetivo contratado" value={c?.required_headcount ?? "—"} tone="primary" />
        <Stat label="Média atendida" value={avg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} tone="info" />
        <Stat label="Dias com déficit" value={gapDays} tone={gapDays ? "danger" : "success"} />
      </div>
      <DataTable rows={days} rowKey={(d) => d.date} pageSize={31}
        cols={[
          { header: "Data", cell: (d) => fmtDate(d.date) },
          { header: "Escalados", cell: (d) => d.scheduled, className: "num text-right" },
          { header: "Presentes", cell: (d) => d.present, className: "num text-right" },
          { header: "Falta parcial", cell: (d) => d.partial, className: "num text-right" },
          { header: "Ausentes", cell: (d) => d.absent, className: "num text-right" },
          { header: "Cobertos", cell: (d) => d.covered, className: "num text-right" },
          { header: "Efetivo", cell: (d) => <strong>{d.effective}</strong>, className: "num text-right" },
          { header: "Situação", cell: (d) => !d.informed ? <Pill tone="warning">Presença pendente</Pill> : d.gap > 0 ? <Pill tone="danger">Déficit de {d.gap}</Pill> : <Pill tone="success">Completo</Pill> },
        ]} />
    </div>
  );
}
