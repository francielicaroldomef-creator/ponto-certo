import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  getMaintenanceOrders,
  saveMaintenanceOrder,
  getVehicles,
  type MaintenanceOrder,
} from "@/lib/fleet-store";
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, FileText, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Caroldo Frotas" }] }),
  component: ManutencoesPage,
});

function ManutencoesPage() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>(() => getMaintenanceOrders());
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [paymentFilter, setPaymentFilter] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<MaintenanceOrder | null>(null);

  // Formulário de Nova Entrada
  const vehicles = getVehicles();
  const [plate, setPlate] = useState(vehicles[0]?.plate || "");
  const [workshop, setWorkshop] = useState("");
  const [service, setService] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [amount, setAmount] = useState(500);

  // Formulário de Edição / Pagamento
  const [exitDate, setExitDate] = useState("");
  const [editStatus, setEditStatus] = useState<MaintenanceOrder["status"]>("Em manutenção");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [proofFileName, setProofFileName] = useState("");

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "Todas" || o.status === statusFilter;
    const matchPayment = paymentFilter === "Todos" || o.payment === paymentFilter;
    return matchStatus && matchPayment;
  });

  const handleOpenEntry = () => {
    setPlate(vehicles[0]?.plate || "");
    setWorkshop("Oficina Central Triunfo");
    setService("");
    setEntryDate(new Date().toISOString().slice(0, 16));
    setAmount(500);
    setModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workshop.trim() || !service.trim()) {
      toast.error("Informe a oficina credenciada e a descrição do serviço.");
      return;
    }

    const newOrder: MaintenanceOrder = {
      id: `OM-${1000 + orders.length + 1}`,
      plate,
      workshop: workshop.trim(),
      service: service.trim(),
      entry: entryDate,
      status: "Em manutenção",
      amount: Number(amount) || 0,
      payment: "Pendente de pagamento",
      history: [
        {
          at: new Date().toISOString(),
          text: `Entrada registrada para manutenção em ${workshop.trim()}.`,
        },
      ],
    };

    const updated = saveMaintenanceOrder(newOrder);
    setOrders(updated);
    setModalOpen(false);
    toast.success(`Ordem de serviço ${newOrder.id} aberta com sucesso!`);
  };

  const handleOpenDetail = (order: MaintenanceOrder) => {
    setDetailOrder(order);
    setEditStatus(order.status);
    setExitDate(order.exit || new Date().toISOString().slice(0, 16));
    setInvoiceNumber(order.invoiceNumber || "");
    setProofFileName(order.proofFile || "");
  };

  const handleSaveDetail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailOrder) return;

    const updatedOrder: MaintenanceOrder = {
      ...detailOrder,
      status: editStatus,
      exit: editStatus.startsWith("Saiu") ? exitDate : undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      proofFile: proofFileName.trim() || undefined,
      history: [
        ...detailOrder.history,
        {
          at: new Date().toISOString(),
          text: `Atualizado para situação "${editStatus}". Nota: ${invoiceNumber || "Não informada"}.`,
        },
      ],
    };

    const updated = saveMaintenanceOrder(updatedOrder);
    setOrders(updated);
    setDetailOrder(null);
    toast.success("Ordem de manutenção atualizada com sucesso!");
  };

  const handleConfirmPayment = (order: MaintenanceOrder) => {
    const updatedOrder: MaintenanceOrder = {
      ...order,
      payment: "Pago",
      paidAt: new Date().toISOString(),
      proofFile: "comprovante_bancario.pdf",
      history: [
        ...order.history,
        {
          at: new Date().toISOString(),
          text: "Pagamento confirmado com comprovante bancário anexado.",
        },
      ],
    };
    const updated = saveMaintenanceOrder(updatedOrder);
    setOrders(updated);
    if (detailOrder?.id === order.id) setDetailOrder(updatedOrder);
    toast.success("Pagamento confirmado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Manutenções & Oficinas"
          description="Gestão de ordens de serviço (OM), controle de entrada/saída, documentos fiscais e confirmação de pagamento."
        />
        <Button onClick={handleOpenEntry} className="gap-2">
          <Plus className="h-4 w-4" /> Nova entrada na oficina
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Situação:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:ring-2 focus:ring-primary"
          >
            <option>Todas</option>
            <option>Em manutenção</option>
            <option>Saiu da oficina e não faturado</option>
            <option>Saiu da oficina</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Pagamento:</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:ring-2 focus:ring-primary"
          >
            <option>Todos</option>
            <option>Pendente de pagamento</option>
            <option>Pago</option>
          </select>
        </div>
      </div>

      {/* Lista de Ordens de Manutenção */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ordem / Veículo</th>
                <th className="px-4 py-3">Oficina Credenciada</th>
                <th className="px-4 py-3">Serviço Realizado</th>
                <th className="px-4 py-3">Entrada / Saída</th>
                <th className="px-4 py-3">Valor Total</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-bold text-foreground text-sm tracking-wide">{o.plate}</span>
                    <p className="text-xs text-muted-foreground">{o.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{o.workshop}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{o.service}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>Entrada: {new Date(o.entry).toLocaleDateString("pt-BR")}</div>
                    {o.exit && <div>Saída: {new Date(o.exit).toLocaleDateString("pt-BR")}</div>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {o.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm text-xs font-semibold ${
                        o.status === "Em manutenção"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : o.status.includes("não faturado")
                          ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm text-xs font-semibold ${
                        o.payment === "Pago"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {o.payment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(o)}
                      className="text-xs"
                    >
                      Gerenciar
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma ordem de manutenção encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Entrada na Oficina */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-foreground">Registrar Entrada na Oficina</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre a ordem de serviço para liberar o atendimento mecânico.
            </p>

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Veículo *</label>
                <select
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                >
                  {vehicles.map((v) => (
                    <option key={v.plate} value={v.plate}>
                      {v.plate} · {v.model} ({v.driver})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Oficina Credenciada *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome da oficina"
                  value={workshop}
                  onChange={(e) => setWorkshop(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Serviço / Descrição *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva o serviço a ser executado"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Data/Hora Entrada</label>
                  <input
                    type="datetime-local"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Valor Previsto (R$)</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Abrir Ordem de Serviço</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Ordem / Saída / Pagamento */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {detailOrder.plate} · {detailOrder.id}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-muted font-bold text-foreground">
                {detailOrder.workshop}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{detailOrder.service}</p>

            <form onSubmit={handleSaveDetail} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Situação do Veículo</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                  >
                    <option value="Em manutenção">Em manutenção</option>
                    <option value="Saiu da oficina e não faturado">Saiu da oficina e não faturado</option>
                    <option value="Saiu da oficina">Saiu da oficina (Concluído)</option>
                    <option value="Aguardando peças">Aguardando peças</option>
                  </select>
                </div>
                {editStatus.startsWith("Saiu") && (
                  <div>
                    <label className="text-xs font-semibold text-foreground">Data/Hora Saída</label>
                    <input
                      type="datetime-local"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Número da Nota Fiscal (NF)</label>
                <input
                  type="text"
                  placeholder="Ex: NF-12345"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
                />
              </div>

              {/* Seção de Pagamento */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Situação do Pagamento</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-sm ${
                      detailOrder.payment === "Pago"
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {detailOrder.payment} · {detailOrder.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                {detailOrder.payment !== "Pago" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-2 text-xs"
                    onClick={() => handleConfirmPayment(detailOrder)}
                  >
                    <Check className="h-4 w-4 text-emerald-500" /> Confirmar Pagamento com Comprovante
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Quitado em{" "}
                    {new Date(detailOrder.paidAt || "").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>

              {/* Histórico */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Histórico de Eventos
                </h4>
                <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                  {detailOrder.history.map((h, i) => (
                    <div key={i} className="flex gap-2 border-l-2 border-primary/30 pl-2">
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {new Date(h.at).toLocaleDateString("pt-BR")}
                      </span>
                      <span>{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setDetailOrder(null)}>
                  Fechar
                </Button>
                <Button type="submit">Salvar Alterações</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
