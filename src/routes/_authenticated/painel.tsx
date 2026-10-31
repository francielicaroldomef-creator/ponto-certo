import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { loadPeriod } from "@/lib/data";
import { brl, fmtDate, hours, todaySP } from "@/lib/format";
import { useDefaultPeriod } from "@/hooks/use-period";
import { ContractSelect, DataTable, PageHeader, Pill, Stat, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel geral — Sistema Integrado Caroldo" }] }),
  component: Painel,
});

function Painel() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const { data: me } = useMe();
  const isFinancial = !!me?.has("admin", "financeiro");
  const { data, isLoading } = useQuery({ queryKey: ["period", contract, from, to, me?.roles?.join(",")], queryFn: () => loadPeriod(contract, from, to, me?.roles), enabled: !!contract });

  const view = useMemo(() => {
    if (!data) return null;
    const today = todaySP();
    const byDate = new Map<string, { date: string; sched: number; missing: number; abs: number; partial: number; uncovered: number; covered: number; waived: number; pending: number; discount: number; cost: number; div: number }>();
    for (const r of data.rows) {
      const d = r.schedule.work_date;
      const e = byDate.get(d) ?? { date: d, sched: 0, missing: 0, abs: 0, partial: 0, uncovered: 0, covered: 0, waived: 0, pending: 0, discount: 0, cost: 0, div: 0 };
      e.sched++;
      if (!r.attendance) e.missing++;
      if (r.attendance?.status === "falta_integral") e.abs++;
      if (r.attendance?.status === "falta_parcial") e.partial++;
      e.uncovered += r.result.uncoveredMin;
      e.covered += r.result.coveredMin;
      e.waived += r.result.waivedMin;
      e.pending += r.result.pendingMin;
      e.discount += r.result.discountCents;
      byDate.set(d, e);
    }
    // coverage cost counted once per post/day
    const seen = new Set<string>();
    for (const r of data.rows) {
      const k = `${r.schedule.post_id}|${r.schedule.work_date}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const e = byDate.get(r.schedule.work_date);
      if (e) e.cost += r.result.coverageCostCents;
    }
    for (const d of data.divergences) { const day = byDate.get(d.work_date); if (d.status === "aberta" && day) day.div++; }
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      days,
      unchecked: days.filter((d) => d.missing > 0 && d.date <= today).length,
      absenceDays: new Set(data.rows.filter((r) => r.attendance?.status?.startsWith("falta")).map((r) => r.schedule.work_date)).size,
      pendingJust: data.rows.filter((r) => r.attendance?.justification_status === "pendente").length,
      pendingCov: data.coverages.filter((c) => c.status === "planejada" || c.status === "confirmada").length,
      uncoveredPosts: data.rows.filter((r) => r.result.uncoveredMin > 0).length,
      openDiv: data.divergences.filter((d) => d.status === "aberta").length,
    };
  }, [data]);

  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Painel geral" description={`Apuração de ${fmtDate(from)} a ${fmtDate(to)}. Indicadores por contrato; impacto financeiro não representa lucro ou margem.`} />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      {isLoading || !data || !view || !t ? <p className="text-muted-foreground">Carregando…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Dias sem conferência" value={view.unchecked} hint="até hoje, com não informados" tone={view.unchecked ? "warning" : "success"} />
            <Stat label="Ausências" value={`${t.integral} integrais · ${t.partial} parciais`} hint={`${view.absenceDays} dia(s) distinto(s) · ${hours(t.absentMin)}`} tone="danger" />
            <Stat label="Justificativas pendentes" value={view.pendingJust} tone={view.pendingJust ? "warning" : "neutral"} />
            <Stat label="Coberturas pendentes" value={view.pendingCov} hint="planejadas ou confirmadas" tone="info" />
            <Stat label="Postos descobertos" value={view.uncoveredPosts} hint={`${hours(t.uncoveredMin)} descobertas`} tone="danger" />
            <Stat label="Divergências abertas" value={view.openDiv} tone={view.openDiv ? "warning" : "success"} />
            {isFinancial ? (
              <>
                <Stat label="Desconto previsto" value={brl(t.discountCents)} hint={data.provisional ? "Provisório" : "Revisado"} tone="danger" />
                <Stat label="Custo das coberturas" value={brl(t.coverageCostCents)} hint={`Impacto das ocorrências: ${brl(t.impactCents)}`} tone="info" />
              </>
            ) : (
              <Stat label="Financeiro" value="Restrito" hint="Apenas Administrador e Financeiro" tone="neutral" />
            )}
            <Stat label="Horas efetivamente cobertas" value={hours(t.coveredMin)} tone="success" />
            <Stat label="Dispensa sem desconto" value={hours(t.waivedMin)} tone="info" />
            <Stat label="Tratamento pendente" value={hours(t.pendingMin)} tone={t.pendingMin ? "warning" : "success"} />
          </div>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Dia a dia</h2>
          <DataTable rows={view.days} rowKey={(d) => d.date} pageSize={31} cols={[
            { header: "Data", cell: (d) => fmtDate(d.date) },
            { header: "Previstos", cell: (d) => d.sched },
            { header: "Conferência", cell: (d) => d.missing ? <Pill tone="warning">{d.missing} não informado(s)</Pill> : <Pill tone="success">Completa</Pill> },
            { header: "Faltas int./parc.", cell: (d) => `${d.abs} / ${d.partial}` },
            { header: "Horas descobertas", cell: (d) => hours(d.uncovered) },
            { header: "Cobertas", cell: (d) => hours(d.covered) },
            { header: "Dispensadas", cell: (d) => hours(d.waived) },
            { header: "Tratamento pendente", cell: (d) => hours(d.pending) },
            ...(isFinancial ? [
              { header: "Desconto", cell: (d: any) => <span className="num">{brl(d.discount)}</span> },
              { header: "Custo cobertura", cell: (d: any) => <span className="num">{brl(d.cost)}</span> },
            ] : []),
            { header: "Divergências", cell: (d) => d.div ? <Pill tone="warning">{d.div} aberta(s)</Pill> : "—" },
          ]} />
        </>
      )}
    </div>
  );
}

