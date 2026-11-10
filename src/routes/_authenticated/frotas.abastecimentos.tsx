import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { getFuelEntries, addFuelEntry, getVehicles, type FuelEntry } from "@/lib/fleet-store";
import { Fuel, Plus, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/abastecimentos")({
  head: () => ({ meta: [{ title: "Abastecimentos — Caroldo Frotas" }] }),
  component: AbastecimentosPage,
});

function AbastecimentosPage() {
  const [entries, setEntries] = useState<FuelEntry[]>(() => getFuelEntries());
  const [modalOpen, setModalOpen] = useState(false);
  const vehicles = getVehicles();

  // Form states
  const [plate, setPlate] = useState(vehicles[0]?.plate || "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState(85000);
  const [liters, setLiters] = useState(60);
  const [pricePerLiter, setPricePerLiter] = useState(6.29);
  const [fullTank, setFullTank] = useState(true);

  const totalFuelAmount = entries.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalLiters = entries.reduce((acc, f) => acc + f.liters, 0);
  const avgPrice = totalLiters > 0 ? totalFuelAmount / totalLiters : 6.29;

  const handleOpenModal = () => {
    const v = vehicles.find((x) => x.plate === plate);
    setOdometer(v ? v.odometer + 400 : 85000);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = liters * pricePerLiter;
    const v = vehicles.find((x) => x.plate === plate);

    const created = addFuelEntry({
      date,
      plate,
      odometer: Number(odometer) || 0,
      liters: Number(liters) || 0,
      totalAmount,
      pricePerLiter: Number(pricePerLiter) || 6.29,
      fullTank,
      driver: v?.driver || "A definir",
    });

    setEntries(getFuelEntries());
    setModalOpen(false);
    toast.success(`Abastecimento ${created.id} lançado com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Controle de Combustível"
          description="Lançamento e monitoramento de abastecimentos, consumo médio por veículo e despesas mensais."
        />
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="h-4 w-4" /> Novo abastecimento
        </Button>
      </div>

      {/* Indicadores Consolidados */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Volume Abastecido</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {totalLiters.toLocaleString("pt-BR")} Litros
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{entries.length} registros no período</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Total Investido</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {totalFuelAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Combustível direto nos contratos</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Preço Médio por Litro</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {avgPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Diesel S10 / Postos conveniados</p>
        </div>
      </div>

      {/* Tabela de Abastecimentos */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código / Data</th>
                <th className="px-4 py-3">Veículo / Motorista</th>
                <th className="px-4 py-3">Hodômetro</th>
                <th className="px-4 py-3">Litros</th>
                <th className="px-4 py-3">Preço / Litro</th>
                <th className="px-4 py-3">Valor Total</th>
                <th className="px-4 py-3">Tanque Cheio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-bold text-foreground text-sm tracking-wide">{f.id}</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.date).toLocaleDateString("pt-BR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-foreground">{f.plate}</span>
                    <p className="text-xs text-muted-foreground">{f.driver}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {f.odometer.toLocaleString("pt-BR")} km
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {f.liters.toLocaleString("pt-BR")} L
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.pricePerLiter.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {f.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm text-xs font-semibold ${
                        f.fullTank
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {f.fullTank ? "Sim" : "Não"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Abastecimento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Registrar Novo Abastecimento</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Informe os dados da nota ou cupom do posto conveniado.
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Veículo *</label>
                  <select
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  >
                    {vehicles.map((v) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} · {v.model}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Data do Abastecimento</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Hodômetro (km)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={odometer}
                    onChange={(e) => setOdometer(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Litros</label>
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    required
                    value={liters}
                    onChange={(e) => setLiters(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Preço / Litro (R$)</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0.1}
                    required
                    value={pricePerLiter}
                    onChange={(e) => setPricePerLiter(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="fullTankCheckbox"
                  checked={fullTank}
                  onChange={(e) => setFullTank(e.target.checked)}
                  className="rounded-sm border-input"
                />
                <label htmlFor="fullTankCheckbox" className="text-sm font-medium text-foreground cursor-pointer">
                  Abastecimento de tanque cheio (recomendado para cálculo de consumo)
                </label>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                <div className="flex justify-between items-center font-bold">
                  <span>Valor Total Estimado:</span>
                  <span className="text-base text-primary">
                    {(liters * pricePerLiter).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Abastecimento</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

