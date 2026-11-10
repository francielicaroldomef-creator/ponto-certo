import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  getVehicleReservations,
  addVehicleReservation,
  cancelVehicleReservation,
  getVehicles,
  type VehicleReservation,
} from "@/lib/fleet-store";
import { CalendarClock, Plus, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/agenda")({
  head: () => ({ meta: [{ title: "Agenda de Reservas — Caroldo Frotas" }] }),
  component: AgendaPage,
});

function AgendaPage() {
  const [reservations, setReservations] = useState<VehicleReservation[]>(() =>
    getVehicleReservations()
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingId, setCancelingId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const vehicles = getVehicles().filter((v) => v.status !== "Em manutenção" && v.status !== "Indisponível");

  // Form states
  const [plate, setPlate] = useState(vehicles[0]?.plate || "");
  const [userName, setUserName] = useState("Carlos Silva");
  const [start, setStart] = useState(() => {
    // 2 dias no futuro para respeitar regra de 24h
    const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [end, setEnd] = useState(() => {
    const d = new Date(Date.now() + 56 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [passengers, setPassengers] = useState(4);

  const handleOpenModal = () => {
    setPlate(vehicles[0]?.plate || "");
    const dStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const dEnd = new Date(Date.now() + 56 * 60 * 60 * 1000);
    setStart(dStart.toISOString().slice(0, 16));
    setEnd(dEnd.toISOString().slice(0, 16));
    setPurpose("");
    setDestination("");
    setPassengers(4);
    setModalOpen(true);
  };

  const handleSaveReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      toast.error("Informe a finalidade do uso do veículo.");
      return;
    }

    const result = addVehicleReservation({
      plate,
      userId: "usr-current",
      userName: userName.trim() || "Colaborador Caroldo",
      start,
      end,
      purpose: purpose.trim(),
      destination: destination.trim(),
      passengers: Number(passengers) || 0,
      contractId: "CT-001",
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setReservations(getVehicleReservations());
    setModalOpen(false);
    toast.success(`Reserva ${result.reservation?.id} confirmada com sucesso!`);
  };

  const handleOpenCancel = (id: string) => {
    setCancelingId(id);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    const result = cancelVehicleReservation(cancelingId, cancelReason);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setReservations(getVehicleReservations());
    setCancelModalOpen(false);
    toast.success("Reserva cancelada com histórico preservado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Agenda & Reservas de Veículos"
          description="Agendamento de saídas operacionais com validação rigorosa de conflitos e antecedência mínima de 24 horas."
        />
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="h-4 w-4" /> Nova reserva
        </Button>
      </div>

      {/* Alerta de Regra Operacional */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Regra de Segurança da Frota (24h de Antecedência):</p>
          <p className="text-muted-foreground mt-0.5">
            Reservas, alterações e cancelamentos só são permitidos com pelo menos 24 horas de antecedência do horário de retirada. Toda operação gera registro auditado com motivo e responsável.
          </p>
        </div>
      </div>

      {/* Tabela de Reservas */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código / Solicitante</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Retirada & Devolução</th>
                <th className="px-4 py-3">Finalidade / Destino</th>
                <th className="px-4 py-3">Passageiros</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reservations.map((r) => {
                const isUpcoming = new Date(r.start).getTime() - Date.now() >= 24 * 60 * 60 * 1000;
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-foreground text-sm tracking-wide">{r.id}</span>
                      <p className="text-xs text-muted-foreground">{r.userName}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{r.plate}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>De: {new Date(r.start).toLocaleString("pt-BR")}</div>
                      <div>Até: {new Date(r.end).toLocaleString("pt-BR")}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-foreground">{r.purpose}</div>
                      {r.destination && (
                        <div className="text-muted-foreground">Destino: {r.destination}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {r.passengers || 0} pessoa(s)
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          r.state === "Agendado"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {r.state}
                      </span>
                      {r.cancelReason && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xs truncate">
                          Motivo: {r.cancelReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.state === "Agendado" && isUpcoming ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenCancel(r.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                        >
                          Cancelar
                        </Button>
                      ) : r.state === "Agendado" ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          Bloqueado (&lt;24h)
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Reserva */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Agendar Uso de Veículo</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione o veículo disponível e os horários de saída e retorno.
            </p>

            <form onSubmit={handleSaveReservation} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Veículo Disponível *</label>
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
                  <label className="text-xs font-semibold text-foreground">Responsável</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Retirada *</label>
                  <input
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Devolução *</label>
                  <input
                    type="datetime-local"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Finalidade do Deslocamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Transporte de equipe técnica para manutenção"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Destino Previsto</label>
                  <input
                    type="text"
                    placeholder="Cidade / Polo industrial"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Qtd. Passageiros</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Confirmar Agendamento</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cancelamento com Motivo */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Cancelar Reserva {cancelingId}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              O cancelamento dentro do prazo de 24h mantém o registro arquivado no histórico.
            </p>

            <form onSubmit={handleConfirmCancel} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Motivo do Cancelamento *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Informe a justificativa do cancelamento"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-sm shadow-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setCancelModalOpen(false)}>
                  Voltar
                </Button>
                <Button type="submit" variant="destructive">
                  Confirmar Cancelamento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

