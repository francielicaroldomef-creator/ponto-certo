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
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resultado")({
  head: () => ({ meta: [{ title: "Resultado por Empresa — CAROLDO · M&F · HELOARTH" }] }),
  component: ResultadoEmpresasPage,
});

function ResultadoEmpresasPage() {
  const [competence, setCompetence] = useState("2026-11");
  const [selectedCompany, setSelectedCompany] = useState<"ALL" | OperatingCompany>("ALL");
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

  const filteredRows =
    selectedCompany === "ALL"
      ? results.rows
      : results.rows.filter((r) => r.company === selectedCompany);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Resultado das Empresas: CAROLDO · M&F · HELOARTH"
          description="Apuração gerencial de receitas, custo de mão de obra direta, gastos de frota e rateio proporcional da sede entre as 3 empresas do grupo."
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

      {/* Cards Comparativos das Três Empresas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["CAROLDO", "MF", "HELOARTH"] as OperatingCompany[]).map((cmp) => {
          const compInfo = COMPANIES[cmp];
          const data = results.byCompany[cmp];
          const isProfitable = data.result >= 0;
          const isSelected = selectedCompany === cmp;

          const themeStyles =
            cmp === "CAROLDO"
              ? "border-primary/40 bg-gradient-to-br from-card to-primary/5 hover:border-primary"
              : cmp === "MF"
              ? "border-blue-500/40 bg-gradient-to-br from-card to-blue-500/5 hover:border-blue-500"
              : "border-purple-500/40 bg-gradient-to-br from-card to-purple-500/5 hover:border-purple-500";

          const iconStyles =
            cmp === "CAROLDO"
              ? "bg-primary/10 text-primary"
              : cmp === "MF"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-purple-500/10 text-purple-500";

          return (
            <div
              key={cmp}
              onClick={() => setSelectedCompany(selectedCompany === cmp ? "ALL" : cmp)}
              className={`cursor-pointer rounded-xl border p-5 shadow-xs transition-all ${themeStyles} ${
                isSelected ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-lg p-2 ${iconStyles}`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                      {compInfo.code}
                    </span>
                    <h3 className="font-bold text-sm text-foreground leading-tight">
                      {compInfo.name}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-card/80 p-2 border border-border/60">
                  <span className="text-[10px] text-muted-foreground">Receita</span>
                  <div className="text-xs font-bold text-foreground">
                    {data.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="rounded-lg bg-card/80 p-2 border border-border/60">
                  <span className="text-[10px] text-muted-foreground">Custos</span>
                  <div className="text-xs font-bold text-foreground">
                    {data.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="rounded-lg bg-card/80 p-2 border border-border/60">
                  <span className="text-[10px] text-muted-foreground">Margem</span>
                  <div
                    className={`text-xs font-bold ${
                      isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {data.margin.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Resultado Líquido:</span>
                <span
                  className={`text-sm font-bold flex items-center gap-1 ${
                    isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isProfitable ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {data.result.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seletor de Abas das Três Empresas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCompany("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCompany === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todas as Empresas ({results.rows.length} contratos)
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompany("CAROLDO")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCompany === "CAROLDO"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            CAROLDO ({results.rows.filter((r) => r.company === "CAROLDO").length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompany("MF")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCompany === "MF"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            M&F ({results.rows.filter((r) => r.company === "MF").length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompany("HELOARTH")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCompany === "HELOARTH"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            HELOARTH ({results.rows.filter((r) => r.company === "HELOARTH").length})
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setRevenueModalOpen(true)}
          className="text-xs gap-1.5 self-end sm:self-auto"
        >
          <Edit3 className="h-3.5 w-3.5" /> Informar Receita
        </Button>
      </div>

      {/* Tabela de Composição por Contrato */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
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
              {filteredRows.map((r) => {
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
                            : r.company === "MF"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
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
                <td className="px-4 py-3 text-foreground">
                  {selectedCompany === "ALL" ? "Total Consolidado do Grupo" : `Subtotal ${selectedCompany}`}
                </td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">{filteredRows.reduce((acc, r) => acc + r.headcount, 0)} pessoas</td>
                <td className="px-4 py-3">
                  {filteredRows.reduce((acc, r) => acc + r.laborCost, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {filteredRows.reduce((acc, r) => acc + r.fleetCost, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {filteredRows.reduce((acc, r) => acc + r.hqShareCost, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {filteredRows.reduce((acc, r) => acc + r.totalCost, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  {filteredRows.reduce((acc, r) => acc + (r.revenue ?? 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3 text-right text-base text-primary">
                  {filteredRows.reduce((acc, r) => acc + (r.netResult ?? 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
              Custos administrativos da matriz a serem rateados proporcionalmente entre os contratos ativos das 3 empresas.
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
                O rateio utiliza a quantidade de colaboradores cadastrados em cada contrato para distribuir os custos fixos da sede com transparência contábil entre CAROLDO, M&F e HELOARTH.
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
