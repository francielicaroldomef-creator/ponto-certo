import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { getTrafficFines, markFinePaid, type TrafficFine } from "@/lib/fleet-store";
import { Receipt, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/frotas/multas")({
  head: () => ({ meta: [{ title: "Multas RS — Caroldo Frotas" }] }),
  component: MultasPage,
});

function MultasPage() {
  const [fines, setFines] = useState<TrafficFine[]>(() => getTrafficFines());

  const handlePay = (id: string) => {
    const updated = markFinePaid(id);
    setFines([...updated]);
    toast.success("Multa marcada como paga!");
  };

  const totalAmount = fines.reduce((acc, f) => acc + f.amount, 0);
  const pendingAmount = fines.filter((f) => f.status === "Pendente").reduce((acc, f) => acc + f.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multas & Infrações de Trânsito"
        description="Acompanhamento de infrações, identificação do condutor responsável e controle de vencimentos Detran RS."
      />

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Total de Notificações</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {fines.length} infrações
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Detran RS / PRF / EPTC</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Total Pendente</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {pendingAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {fines.filter((f) => f.status === "Pendente").length} multa(s) a quitar
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Total Geral Registrado</span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Histórico acumulado da frota</p>
        </div>
      </div>

      {/* Tabela de Multas */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código / Veículo</th>
                <th className="px-4 py-3">Condutor Indicado</th>
                <th className="px-4 py-3">Infração Notificada</th>
                <th className="px-4 py-3">Órgão Emissor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fines.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-bold text-foreground text-sm tracking-wide">{f.plate}</span>
                    <p className="text-xs text-muted-foreground">{f.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{f.driver || "Não indicado"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">{f.infraction}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{f.agency}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground">
                    {new Date(f.dueDate).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {f.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        f.status === "Pendente"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {f.status === "Pendente" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePay(f.id)}
                        className="text-xs gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" /> Quitar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Quitada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

