import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { getVehicles, saveVehicle, type Vehicle } from "@/lib/fleet-store";
import { Car, Plus, Search, CheckCircle2, Wrench, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Caroldo Frotas" }] }),
  component: VeiculosPage,
});

function VeiculosPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form states
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [driver, setDriver] = useState("");
  const [odometer, setOdometer] = useState(0);
  const [consumption, setConsumption] = useState(9.0);
  const [status, setStatus] = useState<Vehicle["status"]>("Disponível");
  const [contractId, setContractId] = useState("CT-001");

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.driver.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = (v?: Vehicle) => {
    if (v) {
      setEditingVehicle(v);
      setPlate(v.plate);
      setModel(v.model);
      setDriver(v.driver);
      setOdometer(v.odometer);
      setConsumption(v.consumptionKmPerL);
      setStatus(v.status);
      setContractId(v.contractId);
    } else {
      setEditingVehicle(null);
      setPlate("");
      setModel("");
      setDriver("");
      setOdometer(0);
      setConsumption(9.0);
      setStatus("Disponível");
      setContractId("CT-001");
    }
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !model.trim()) {
      toast.error("Informe a placa e o modelo do veículo.");
      return;
    }

    const item: Vehicle = {
      plate: plate.trim().toUpperCase(),
      model: model.trim(),
      driver: driver.trim() || "A definir",
      odometer: Number(odometer) || 0,
      consumptionKmPerL: Number(consumption) || 9.0,
      status,
      contractId,
    };

    const updated = saveVehicle(item);
    setVehicles(updated);
    setModalOpen(false);
    toast.success(`Veículo ${item.plate} gravado com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Veículos da Frota"
          description="Cadastro de vans, utilitários e veículos de apoio operacional, com monitoramento de quilometragem e consumo."
        />
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="h-4 w-4" /> Novo veículo
        </Button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por placa, modelo ou motorista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Situação:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
          >
            <option>Todos</option>
            <option>Disponível</option>
            <option>Em uso</option>
            <option>Em manutenção</option>
            <option>Indisponível</option>
          </select>
        </div>
      </div>

      {/* Tabela de Veículos */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Placa / Modelo</th>
                <th className="px-4 py-3">Motorista Vinculado</th>
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3">Hodômetro Atual</th>
                <th className="px-4 py-3">Consumo Médio</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.plate} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-md bg-primary/10 p-2 text-primary">
                        <Car className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-foreground text-sm tracking-wide">{v.plate}</span>
                        <p className="text-xs text-muted-foreground">{v.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-medium">{v.driver}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-muted text-foreground text-xs font-semibold">
                      {v.contractId}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {v.odometer.toLocaleString("pt-BR")} km
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {v.consumptionKmPerL.toLocaleString("pt-BR")} km/l
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        v.status === "Disponível"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : v.status === "Em uso"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : v.status === "Em manutenção"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {v.status === "Disponível" && <CheckCircle2 className="h-3 w-3" />}
                      {v.status === "Em manutenção" && <Wrench className="h-3 w-3" />}
                      {v.status === "Em uso" && <Clock className="h-3 w-3" />}
                      {v.status === "Indisponível" && <ShieldAlert className="h-3 w-3" />}
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(v)}
                      className="text-xs"
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum veículo encontrado nesta seleção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro / Edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">
              {editingVehicle ? `Editar Veículo ${editingVehicle.plate}` : "Cadastrar Novo Veículo"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Informe os dados de identificação, motorista responsável e situação na frota.
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Placa *</label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="ABC1D23"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm uppercase shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Contrato Vinculado</label>
                  <select
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  >
                    <option value="CT-001">CT-001 · Polo Triunfo</option>
                    <option value="CT-002">CT-002 · Polo Montenegro</option>
                    <option value="CT-003">CT-003 · Manutenção Predial</option>
                    <option value="CT-004">CT-004 · Logística Delta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Modelo e Ano *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fiat Ducato Maxi · 2022"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Motorista Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do motorista titular"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Hodômetro (km)</label>
                  <input
                    type="number"
                    min={0}
                    value={odometer}
                    onChange={(e) => setOdometer(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Consumo (km/l)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    value={consumption}
                    onChange={(e) => setConsumption(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Situação</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  >
                    <option>Disponível</option>
                    <option>Em uso</option>
                    <option>Em manutenção</option>
                    <option>Indisponível</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Veículo</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
