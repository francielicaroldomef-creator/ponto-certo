import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  calculateCompanyResults,
  saveContractRevenue,
  saveHQExpense,
  getHQExpenses,
  COMPANIES,
  type OperatingCompany,
} from "@/lib/company-results-store";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Car,
  PieChart,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resultado")({
  head: () => ({ meta: [{ title: "Resultado por Empresa — CAROLDO / M&F" }] }),
  component: ResultadoEmpresasPage,
});

function ResultadoEmpresasPage() {
  const [competence, setCompetence] = useState("2026-11");
  const [hqModalOpen, setHqModalOpen] = useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("CT-001");
  const [newRevenue, setNewRevenue] = useState(89000);
  const [hqAmount, setHqAmount] = useState(() => getHQExpenses("2026-11"));

  const results = calculateCompanyResults(competence);

  const handleSaveRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    saveContractRevenue(competence, selectedContractId, Number(newRevenue) || 0);
    setRevenueModalOpen(false);
    toast.success("Receita mensal do contrato atualizada!");
  };

  const handleSaveHQ = (e: React.FormEvent) => {
    e.preventDefault();
    saveHQExpense(competence, Number(hqAmount) || 0);
    setHqModalOpen(false);
    toast.success("Despesas da sede atualizadas com recálculo do rateio!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Resultado Operacional CAROLDO & M&F"
          description="Apuração de receitas, custos de pessoal, gastos de frota e rateio proporcional da sede entre as empresas e contratos."
        />
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={competence}
            onChange={(e) => {
              setCompetence(e.target.value);
              setHqAmount(getHQExpenses(e.target.value));
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:ring-2 focus:ring-primary"
          />
          <Button
            variant="outline"
            onClick={() => setHqModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Building2 className="h-4 w-4 text-primary" /> Despesas da Sede
          </Button>
        </div>
      </div>

      {/* Cards Comparativos por Empresa: CAROLDO vs M&F */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["CAROLDO", "MF"] as OperatingCompany[]).map((cmp) => {
          const compInfo = COMPANIES[cmp];
          const data = results.byCompany[cmp];
          const isProfitable = data.result >= 0;

          return (
            <div
              key={cmp}
              className={`rounded-xl border p-5 shadow-xs transition-all ${
                cmp === "CAROLDO"
                  ? "border-primary/40 bg-gradient-to-br from-card to-primary/5"
                  : "border-blue-500/40 bg-gradient-to-br from-card to-blue-500/5"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`rounded-lg p-2 ${
                      cmp === "CAROLDO"
                        ? "bg-primary/10 text-primary"
                        : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      {compInfo.code}
                    </span>
                    <h3 className="font-bold text-base text-foreground leading-tight">
                      {compInfo.name}
                    </h3>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{compInfo.city}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-card p-2 border border-border/60">
                  <span className="text-[11px] text-muted-foreground">Receita</span>
                  <div className="text-sm font-bold text-foreground">
                    {data.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="rounded-lg bg-card p-2 border border-border/60">
                  <span className="text-[11px] text-muted-foreground">Custos Totais</span>
                  <div className="text-sm font-bold text-foreground">
                    {data.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="rounded-lg bg-card p-2 border border-border/60">
                  <span className="text-[11px] text-muted-foreground">Margem</span>
                  <div
                    className={`text-sm font-bold ${
                      isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {data.margin.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Resultado Operacional:</span>
                <span
                  className={`text-base font-bold flex items-center gap-1 ${
                    isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {data.result.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela de Composição por Contrato */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Composição dos Contratos · {competence}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pessoal direto, custos de frota alocados e rateio proporcional da sede.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRevenueModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5" /> Informar Receita
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Contrato / Cliente</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Pessoal</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Rateio Sede</th>
                <th className="px-4 py-3">Custo Consolidado</th>
                <th className="px-4 py-3">Receita Mensal</th>
                <th className="px-4 py-3 text-right">Resultado Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.rows.map((r) => {
                const isPositive = (r.netResult ?? 0) >= 0;
                return (
                  <tr key={r.contractId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-foreground text-sm">{r.contractId}</span>
                      <p className="text-xs text-muted-foreground">{r.contractDescription}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm text-xs font-bold ${
                          r.company === "CAROLDO"
                            ? "bg-primary/10 text-primary"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {r.company}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.headcount} pessoas</td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {r.laborCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {r.fleetCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {r.hqShareCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {r.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {r.revenue !== null
                        ? r.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "A informar"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.netResult !== null ? (
                        <div className="font-bold text-sm">
                          <span
                            className={
                              isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {r.netResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="block text-[11px] text-muted-foreground font-normal">
                            Margem: {r.marginPercent?.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Receita pendente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/30 font-bold text-sm">
              <tr>
                <td className="px-4 py-3 text-foreground">Total Geral Consolidado</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">{results.rows.reduce((acc, r) => acc + r.headcount, 0)} pessoas</td>
                <td className="px-4 py-3">
                  {results.totalLabor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {results.totalFleet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {results.totalHQ.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {results.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {results.totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td
                  className={`px-4 py-3 text-right text-base ${
                    results.netResult >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {results.netResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  <span className="block text-xs font-normal text-muted-foreground">
                    Margem global: {results.overallMargin.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Despesas da Sede */}
      {hqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Despesas da Sede · {competence}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Custos administrativos da matriz a serem rateados proporcionalmente entre os contratos ativos.
            </p>

            <form onSubmit={handleSaveHQ} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Custo Total da Sede no Mês (R$) *</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  required
                  value={hqAmount}
                  onChange={(e) => setHqAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-md">
                O rateio utiliza a quantidade de colaboradores cadastrados em cada contrato para distribuir os custos fixos da sede com transparência contábil.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setHqModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar e Recalcular Rateio</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Informar Receita do Contrato */}
      {revenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Informar Receita · {competence}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre o faturamento mensal do contrato para apuração do resultado líquido.
            </p>

            <form onSubmit={handleSaveRevenue} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Contrato *</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                >
                  {results.rows.map((r) => (
                    <option key={r.contractId} value={r.contractId}>
                      {r.contractId} · {r.contractDescription} ({r.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Receita Faturada (R$) *</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  required
                  value={newRevenue}
                  onChange={(e) => setNewRevenue(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setRevenueModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Receita</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
