import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  getMaintenanceTickets,
  addMaintenanceTicket,
  updateTicketStatus,
  getVehicles,
  type MaintenanceTicket,
} from "@/lib/fleet-store";
import { MessageSquareWarning, Plus, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/chamados")({
  head: () => ({ meta: [{ title: "Chamados dos Motoristas — Caroldo Frotas" }] }),
  component: ChamadosPage,
});

function ChamadosPage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(() => getMaintenanceTickets());
  const [modalOpen, setModalOpen] = useState(false);
  const vehicles = getVehicles();

  // Form states
  const [plate, setPlate] = useState(vehicles[0]?.plate || "");
  const [driver, setDriver] = useState(vehicles[0]?.driver || "");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<MaintenanceTicket["priority"]>("Normal");

  const handleOpenModal = () => {
    const v = vehicles[0];
    setPlate(v?.plate || "");
    setDriver(v?.driver || "");
    setText("");
    setPriority("Normal");
    setModalOpen(true);
  };

  const handleVehicleChange = (p: string) => {
    setPlate(p);
    const v = vehicles.find((x) => x.plate === p);
    if (v) setDriver(v.driver);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Descreva o problema ou ruído identificado no veículo.");
      return;
    }

    const created = addMaintenanceTicket({
      plate,
      driver,
      text: text.trim(),
      priority,
      status: "Em análise",
    });

    setTickets(getMaintenanceTickets());
    setModalOpen(false);
    toast.success(`Chamado ${created.id} aberto com sucesso!`);
  };

  const handleStatusChange = (id: string, newStatus: MaintenanceTicket["status"]) => {
    const updated = updateTicketStatus(id, newStatus);
    setTickets([...updated]);
    toast.success("Status do chamado atualizado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Chamados Operacionais de Manutenção"
          description="Canal direto para motoristas e encarregados relatarem falhas, ruídos, revisões e emergências na frota."
        />
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="h-4 w-4" /> Abrir novo chamado
        </Button>
      </div>

      {/* Grid de Chamados */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tickets.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-foreground tracking-wide">{t.plate}</span>
                  <span className="text-xs text-muted-foreground font-mono">({t.id})</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                    t.priority === "Urgente"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : t.priority === "Veículo parado" || t.priority === "Emergência"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {t.priority}
                </span>
              </div>

              <p className="mt-3 text-sm text-foreground leading-relaxed">{t.text}</p>
              <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground flex justify-between">
                <span>Motorista: <strong>{t.driver}</strong></span>
                <span>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Situação:</span>
              <select
                value={t.status}
                onChange={(e) => handleStatusChange(t.id, e.target.value as any)}
                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium shadow-xs focus:ring-1 focus:ring-primary"
              >
                <option value="Em análise">Em análise</option>
                <option value="Agendado">Agendado</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Abertura de Chamado */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Abrir Chamado de Manutenção</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Descreva o problema para que a equipe técnica providencie o reparo.
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Veículo *</label>
                  <select
                    value={plate}
                    onChange={(e) => handleVehicleChange(e.target.value)}
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
                  <label className="text-xs font-semibold text-foreground">Prioridade *</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Veículo parado">Veículo parado</option>
                    <option value="Emergência">Emergência</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Motorista Relatante</label>
                <input
                  type="text"
                  required
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Descrição Detalhada do Problema *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Barulho agudo nos freios ao pisar levemente, vibração no volante acima de 80 km/h, etc."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Enviar Chamado</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

