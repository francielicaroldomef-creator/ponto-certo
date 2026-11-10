import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  getVehicles,
  getMaintenanceOrders,
  getFuelEntries,
  getMaintenanceTickets,
  getTrafficFines,
} from "@/lib/fleet-store";
import {
  Car,
  Wrench,
  Fuel,
  MessageSquareWarning,
  CalendarClock,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/frotas")({
  head: () => ({ meta: [{ title: "Gestão de Frotas — Caroldo Frotas" }] }),
  component: FrotasDashboardPage,
});

function FrotasDashboardPage() {
  const [period, setPeriod] = useState("2026-11");
  const vehicles = getVehicles();
  const maintenance = getMaintenanceOrders();
  const fuel = getFuelEntries().filter((f) => f.date.startsWith(period));
  const tickets = getMaintenanceTickets();
  const fines = getTrafficFines();

  const totalFuelAmount = fuel.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalLiters = fuel.reduce((acc, f) => acc + f.liters, 0);
  const avgFuelPrice = totalLiters > 0 ? totalFuelAmount / totalLiters : 6.29;

  const totalMaintAmount = maintenance
    .filter((m) => m.entry.startsWith(period))
    .reduce((acc, m) => acc + m.amount, 0);

  const pendingPaymentMaint = maintenance.filter((m) => m.payment !== "Pago");
  const pendingPaymentTotal = pendingPaymentMaint.reduce((acc, m) => acc + m.amount, 0);

  const vehiclesInMaint = vehicles.filter((v) => v.status === "Em manutenção").length;
  const vehiclesInUse = vehicles.filter((v) => v.status === "Em uso").length;
  const vehiclesAvailable = vehicles.filter((v) => v.status === "Disponível").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Gestão de Frotas Caroldo"
          description="Controle operacional e financeiro de veículos, manutenções, combustível, chamados e agenda."
        />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Competência:
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Faixa de Indicadores de Frota */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Veículos Cadastrados</span>
            <Car className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {vehicles.length} veículos
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {vehiclesAvailable} disponíveis · {vehiclesInUse} em uso · {vehiclesInMaint} na oficina
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Combustível no Mês</span>
            <Fuel className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {totalFuelAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {totalLiters.toLocaleString("pt-BR")} L (média {avgFuelPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/L)
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Manutenção no Mês</span>
            <Wrench className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {totalMaintAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {maintenance.filter((m) => m.entry.startsWith(period)).length} ordens de serviço
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pendências Financeiras</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {pendingPaymentTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {pendingPaymentMaint.length} ordem(ns) aguardando comprovante
          </div>
        </div>
      </div>

      {/* Ações Rápidas da Frota */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/frotas/veiculos"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Car className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Cadastro & Status dos Veículos</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Placas, modelos, motoristas vinculados, odômetro atualizado e situação da frota.
          </p>
        </Link>

        <Link
          to="/frotas/manutencoes"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-500">
              <Wrench className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Ordens de Manutenção (OM)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Entrada na oficina, liberação sem nota ("não faturado"), documentos fiscais e comprovantes.
          </p>
        </Link>

        <Link
          to="/frotas/abastecimentos"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-500">
              <Fuel className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Abastecimentos & Consumo</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Registro de combustível por placa, hodômetro, volume abastecido e acompanhamento de km/l.
          </p>
        </Link>

        <Link
          to="/frotas/chamados"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-rose-500/10 p-2.5 text-rose-500">
              <MessageSquareWarning className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Chamados dos Motoristas</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Solicitações de reparo com classificação de urgência, histórico e encaminhamento para oficina.
          </p>
        </Link>

        <Link
          to="/frotas/agenda"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500">
              <CalendarClock className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Agenda & Reservas de Veículos</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Calendário de utilização com regra de antecedência de 24h e bloqueio automático de conflitos.
          </p>
        </Link>

        <Link
          to="/frotas/multas"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-500">
              <Receipt className="h-6 w-6" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Multas Detran / RS</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhamento de infrações de trânsito, prazos de recurso, indicação de condutor e vencimentos.
          </p>
        </Link>
      </div>

      {/* Visão de Manutenções Recentes & Chamados Abertos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Ordens de Manutenção Recentes</h2>
            <Link to="/frotas/manutencoes" className="text-xs font-medium text-primary hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-border/60">
            {maintenance.slice(0, 4).map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold text-foreground">{m.plate}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{m.workshop}</span>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{m.service}</p>
                </div>
                <div className="text-right">
                  <span className="font-medium text-foreground">
                    {m.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <div>
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-sm ${
                        m.status === "Em manutenção"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : m.status.includes("não faturado")
                          ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Chamados Operacionais dos Motoristas</h2>
            <Link to="/frotas/chamados" className="text-xs font-medium text-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-border/60">
            {tickets.slice(0, 4).map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{t.plate}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${
                        t.priority === "Urgente" || t.priority === "Veículo parado"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.text}</p>
                  <p className="text-[11px] text-muted-foreground">Motorista: {t.driver}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-muted-foreground">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

