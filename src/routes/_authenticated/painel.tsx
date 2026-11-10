import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { loadPeriod } from "@/lib/data";
import { brl, fmtDate, hours, todaySP } from "@/lib/format";
import { useDefaultPeriod } from "@/hooks/use-period";
import { ContractSelect, DataTable, PageHeader, Pill, Stat, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { useMe } from "@/hooks/use-auth";
import { getVehicles, getMaintenanceOrders, getFuelEntries } from "@/lib/fleet-store";
import { calculateCompanyResults } from "@/lib/company-results-store";
import {
  Car,
  UsersRound,
  Building2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Fuel,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel Geral Unificado — Sistema Integrado Caroldo" }] }),
  component: Painel,
});

function Painel() {
  const [activeTab, setActiveTab] = useState<"unificada" | "operacao">("unificada");
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const { data: me } = useMe();
  const isFinancial = !!me?.has("admin", "financeiro");
  const { data, isLoading } = useQuery({
    queryKey: ["period", contract, from, to, me?.roles?.join(",")],
    queryFn: () => loadPeriod(contract, from, to, me?.roles),
    enabled: !!contract,
  });

  // Dados consolidados de Frotas e Empresas
  const vehicles = useMemo(() => getVehicles(), []);
  const maintenanceOrders = useMemo(() => getMaintenanceOrders(), []);
  const fuelEntries = useMemo(() => getFuelEntries(), []);
  const companyResults = useMemo(() => calculateCompanyResults("2026-11"), []);

  const totalFuelMonth = fuelEntries.reduce((sum, f) => sum + f.totalAmount, 0);
  const vehiclesInMaint = vehicles.filter((v) => v.status === "Em manutenção").length;
  const pendingOrders = maintenanceOrders.filter((m) => m.payment !== "Pago");

  const view = useMemo(() => {
    if (!data) return null;
    const today = todaySP();
    const byDate = new Map<
      string,
      {
        date: string;
        sched: number;
        missing: number;
        abs: number;
        partial: number;
        uncovered: number;
        covered: number;
        waived: number;
        pending: number;
        discount: number;
        cost: number;
        div: number;
      }
    >();
    for (const r of data.rows) {
      const d = r.schedule.work_date;
      const e = byDate.get(d) ?? {
        date: d,
        sched: 0,
        missing: 0,
        abs: 0,
        partial: 0,
        uncovered: 0,
        covered: 0,
        waived: 0,
        pending: 0,
        discount: 0,
        cost: 0,
        div: 0,
      };
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
    for (const d of data.divergences) {
      const day = byDate.get(d.work_date);
      if (d.status === "aberta" && day) day.div++;
    }
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      days,
      unchecked: days.filter((d) => d.missing > 0 && d.date <= today).length,
      absenceDays: new Set(
        data.rows.filter((r) => r.attendance?.status?.startsWith("falta")).map((r) => r.schedule.work_date)
      ).size,
      pendingJust: data.rows.filter((r) => r.attendance?.justification_status === "pendente").length,
      pendingCov: data.coverages.filter((c) => c.status === "planejada" || c.status === "confirmada").length,
      uncoveredPosts: data.rows.filter((r) => r.result.uncoveredMin > 0).length,
      openDiv: data.divergences.filter((d) => d.status === "aberta").length,
    };
  }, [data]);

  const t = data?.totals;

  return (
    <div className="space-y-6">
      {/* Banner de Boas-vindas Unificado */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              CAROLDO · CENTRO INTEGRADO DE OPERAÇÕES
            </span>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Uma visão completa. Três áreas conectadas.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Frota, efetivo operacional e resultado consolidado das empresas no mesmo ambiente de gestão.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("unificada")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "unificada"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Visão Unificada
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("operacao")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "operacao"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Apuração do Efetivo
            </button>
          </div>
        </div>
      </div>

      {activeTab === "unificada" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Métricas Consolidadas das Três Frentes */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <span className="text-xs font-medium text-muted-foreground">01 · Frota Ativa</span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {vehicles.length} veículos
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {vehicles.filter((v) => v.status === "Disponível").length} disponíveis · {vehiclesInMaint} na oficina
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <span className="text-xs font-medium text-muted-foreground">02 · Efetivo Previsto</span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {companyResults.rows.reduce((acc, r) => acc + r.headcount, 0)} colaboradores
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Distribuídos em postos de serviço</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <span className="text-xs font-medium text-muted-foreground">03 · Custos da Frota</span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {totalFuelMonth.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Combustível e manutenções do mês</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <span className="text-xs font-medium text-muted-foreground">Resultado Líquido</span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {companyResults.netResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Margem global: {companyResults.overallMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Cards das Três Grandes Áreas */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    01
                  </span>
                  <Car className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">Gestão de Frotas</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Veículos, manutenção preventiva, combustível, chamados e agenda com antecedência de 24h.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Módulo Completo</span>
                <Link
                  to="/frotas"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Abrir Frota <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-500">
                    02
                  </span>
                  <UsersRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">Portal do Supervisor</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conferência diária de presença, controle de postos descobertos, diaristas e coberturas.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Efetividade Diária</span>
                <Link
                  to="/conferencia"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Conferência <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-500">
                    03
                  </span>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">CAROLDO · M&F · HELOARTH</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contratos das 3 empresas, centros de custos, rateio proporcional da sede e resultado financeiro consolidado.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">DRE & Margens</span>
                <Link
                  to="/resultado"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Ver Resultado <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Central de Atenção Unificada & Resumo Financeiro */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Central de Atenção Unificada</h2>
                <span className="text-xs text-muted-foreground">Alertas operacionais</span>
              </div>
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <Wrench className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-foreground">{vehiclesInMaint} veículo(s) em manutenção</p>
                    <p className="text-muted-foreground">Acompanhe saídas e notas fiscais para liberação.</p>
                  </div>
                  <Link to="/frotas/manutencoes" className="text-xs font-semibold text-primary hover:underline">
                    Ver →
                  </Link>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-foreground">
                      {pendingOrders.length} pagamento(s) de oficina pendente(s)
                    </p>
                    <p className="text-muted-foreground">Necessário envio de comprovante bancário.</p>
                  </div>
                  <Link to="/frotas/manutencoes" className="text-xs font-semibold text-primary hover:underline">
                    Quitar →
                  </Link>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-foreground">Conferência diária do efetivo</p>
                    <p className="text-muted-foreground">Postos operando normalmente com cobertura ativa.</p>
                  </div>
                  <Link to="/coberturas" className="text-xs font-semibold text-primary hover:underline">
                    Coberturas →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Resultado por Empresa (Competência Atual)</h2>
                <Link to="/resultado" className="text-xs font-semibold text-primary hover:underline">
                  Detalhar análise →
                </Link>
              </div>
              <div className="mt-3 divide-y divide-border/60">
                {companyResults.rows.map((r) => (
                  <div key={r.contractId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground">{r.contractId}</span>
                      <span className="ml-2 font-semibold text-primary">({r.company})</span>
                      <p className="text-[11px] text-muted-foreground">{r.contractDescription}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground">
                        {r.revenue !== null
                          ? r.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "A informar"}
                      </span>
                      <span
                        className={`block text-[11px] font-semibold ${
                          (r.netResult ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {r.netResult !== null
                          ? `${r.netResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${r.marginPercent?.toFixed(1)}%)`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "operacao" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row">
            <ContractSelect value={contract} onChange={setContract} />
            <DatePicker value={from} onChange={setFrom} label="De" />
            <DatePicker value={to} onChange={setTo} label="Até" />
          </div>

          {isLoading || !data || !view || !t ? (
            <p className="text-muted-foreground">Carregando apuração…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Dias sem conferência"
                  value={view.unchecked}
                  hint="até hoje, com não informados"
                  tone={view.unchecked ? "warning" : "success"}
                />
                <Stat
                  label="Ausências"
                  value={`${t.integral} integrais · ${t.partial} parciais`}
                  hint={`${view.absenceDays} dia(s) distinto(s) · ${hours(t.absentMin)}`}
                  tone="danger"
                />
                <Stat
                  label="Justificativas pendentes"
                  value={view.pendingJust}
                  tone={view.pendingJust ? "warning" : "neutral"}
                />
                <Stat
                  label="Coberturas pendentes"
                  value={view.pendingCov}
                  hint="planejadas ou confirmadas"
                  tone="info"
                />
                <Stat
                  label="Postos descobertos"
                  value={view.uncoveredPosts}
                  hint={`${hours(t.uncoveredMin)} descobertas`}
                  tone="danger"
                />
                <Stat
                  label="Divergências abertas"
                  value={view.openDiv}
                  tone={view.openDiv ? "warning" : "success"}
                />
                {isFinancial ? (
                  <>
                    <Stat
                      label="Desconto previsto"
                      value={brl(t.discountCents)}
                      hint={data.provisional ? "Provisório" : "Revisado"}
                      tone="danger"
                    />
                    <Stat
                      label="Custo das coberturas"
                      value={brl(t.coverageCostCents)}
                      hint={`Impacto das ocorrências: ${brl(t.impactCents)}`}
                      tone="info"
                    />
                  </>
                ) : (
                  <Stat
                    label="Financeiro"
                    value="Restrito"
                    hint="Apenas Administrador e Financeiro"
                    tone="neutral"
                  />
                )}
                <Stat
                  label="Horas efetivamente cobertas"
                  value={hours(t.coveredMin)}
                  tone="success"
                />
                <Stat
                  label="Dispensa sem desconto"
                  value={hours(t.waivedMin)}
                  tone="info"
                />
                <Stat
                  label="Tratamento pendente"
                  value={hours(t.pendingMin)}
                  tone={t.pendingMin ? "warning" : "success"}
                />
              </div>

              <h2 className="mb-3 mt-8 text-lg font-semibold text-foreground">Dia a dia Operacional</h2>
              <DataTable
                rows={view.days}
                rowKey={(d) => d.date}
                pageSize={31}
                cols={[
                  { header: "Data", cell: (d) => fmtDate(d.date) },
                  { header: "Previstos", cell: (d) => d.sched },
                  {
                    header: "Conferência",
                    cell: (d) =>
                      d.missing ? (
                        <Pill tone="warning">{d.missing} não informado(s)</Pill>
                      ) : (
                        <Pill tone="success">Completa</Pill>
                      ),
                  },
                  { header: "Faltas int./parc.", cell: (d) => `${d.abs} / ${d.partial}` },
                  { header: "Horas descobertas", cell: (d) => hours(d.uncovered) },
                  { header: "Cobertas", cell: (d) => hours(d.covered) },
                  { header: "Dispensadas", cell: (d) => hours(d.waived) },
                  { header: "Tratamento pendente", cell: (d) => hours(d.pending) },
                  ...(isFinancial
                    ? [
                        { header: "Desconto", cell: (d: any) => <span className="num">{brl(d.discount)}</span> },
                        { header: "Custo cobertura", cell: (d: any) => <span className="num">{brl(d.cost)}</span> },
                      ]
                    : []),
                  {
                    header: "Divergências",
                    cell: (d) => (d.div ? <Pill tone="warning">{d.div} aberta(s)</Pill> : "—"),
                  },
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
