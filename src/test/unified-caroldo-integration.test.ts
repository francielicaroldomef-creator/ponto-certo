import { describe, expect, it, beforeEach } from "vitest";
import {
  getVehicles,
  saveVehicle,
  getMaintenanceOrders,
  saveMaintenanceOrder,
  getFuelEntries,
  addFuelEntry,
  getMaintenanceTickets,
  addMaintenanceTicket,
  getVehicleReservations,
  addVehicleReservation,
  cancelVehicleReservation,
} from "@/lib/fleet-store";
import {
  calculateCompanyResults,
  saveHQExpense,
  saveContractRevenue,
  COMPANIES,
} from "@/lib/company-results-store";
import { AVAILABLE_MODULES } from "@/lib/quick-access";

describe("🌟 UNIFICAÇÃO CAROLDO GESTÃO — FROTAS, SUPERVISOR E CAROLDO / M&F", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("1. Gestão de Frotas: listagem inicial e cadastro de novos veículos com odômetro", () => {
    const list = getVehicles();
    expect(list.length).toBeGreaterThanOrEqual(5);

    const ducato = list.find((v) => v.plate === "ABC1D23");
    expect(ducato).toBeDefined();
    expect(ducato?.model).toContain("Ducato");
    expect(ducato?.status).toBe("Disponível");

    // Cadastro de novo utilitário
    const updated = saveVehicle({
      plate: "XYZ9W99",
      model: "Fiat Fiorino 1.4 · 2024",
      driver: "Marcos Operador",
      odometer: 15400,
      consumptionKmPerL: 11.5,
      status: "Disponível",
      contractId: "CT-001",
    });

    const found = updated.find((v) => v.plate === "XYZ9W99");
    expect(found).toBeDefined();
    expect(found?.odometer).toBe(15400);
  });

  it("2. Manutenção da Frota: entrada na oficina, liberação sem nota e pagamento com histórico", () => {
    const orders = getMaintenanceOrders();
    expect(orders.length).toBeGreaterThanOrEqual(1);

    // Nova ordem
    const newOrder = {
      id: "OM-9999",
      plate: "ABC1D23",
      workshop: "Oficina Central Triunfo",
      service: "Troca preventiva de pastilhas de freio",
      entry: "2026-11-10T10:00",
      status: "Em manutenção" as const,
      amount: 450,
      payment: "Pendente de pagamento" as const,
      history: [{ at: "2026-11-10T10:00", text: "Entrada na oficina." }],
    };

    saveMaintenanceOrder(newOrder);
    let current = getMaintenanceOrders().find((o) => o.id === "OM-9999");
    expect(current).toBeDefined();
    expect(current?.status).toBe("Em manutenção");

    // Liberação sem nota fiscal (saiu da oficina e não faturado)
    current!.status = "Saiu da oficina e não faturado";
    current!.exit = "2026-11-10T16:00";
    current!.history.push({ at: "2026-11-10T16:00", text: "Veículo liberado sem nota fiscal." });
    saveMaintenanceOrder(current!);

    const reloaded = getMaintenanceOrders().find((o) => o.id === "OM-9999");
    expect(reloaded?.status).toBe("Saiu da oficina e não faturado");
    expect(reloaded?.payment).toBe("Pendente de pagamento");

    // Veículo ABC1D23 volta a ficar Disponível após a saída da oficina
    const vehicles = getVehicles();
    expect(vehicles.find((v) => v.plate === "ABC1D23")?.status).toBe("Disponível");
  });

  it("3. Abastecimento e Consumo: lançamento de combustível atualiza odômetro do veículo", () => {
    const vBefore = getVehicles().find((v) => v.plate === "ABC1D23")!;
    const newOdo = vBefore.odometer + 450;

    const entry = addFuelEntry({
      date: "2026-11-10",
      plate: "ABC1D23",
      odometer: newOdo,
      liters: 50,
      totalAmount: 314.5,
      pricePerLiter: 6.29,
      fullTank: true,
      driver: "Carlos Silva",
    });

    expect(entry.id).toContain("ABAST-");
    expect(entry.totalAmount).toBe(314.5);

    const vAfter = getVehicles().find((v) => v.plate === "ABC1D23")!;
    expect(vAfter.odometer).toBe(newOdo);
  });

  it("4. Agenda de Veículos: bloqueio estrito para reservas com menos de 24h e detecção de conflitos", () => {
    // Tentativa com menos de 24 horas -> Deve rejeitar
    const invalidStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const invalidEnd = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16);

    const invalidRes = addVehicleReservation({
      plate: "ABC1D23",
      userId: "usr-01",
      userName: "Motorista A",
      start: invalidStart,
      end: invalidEnd,
      purpose: "Viagem emergencial",
    });

    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain("24 horas");

    // Tentativa válida com 48h no futuro
    const validStart = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const validEnd = new Date(Date.now() + 54 * 60 * 60 * 1000).toISOString().slice(0, 16);

    const validRes = addVehicleReservation({
      plate: "ABC1D23",
      userId: "usr-01",
      userName: "Motorista A",
      start: validStart,
      end: validEnd,
      purpose: "Transporte planejado de equipe",
    });

    expect(validRes.success).toBe(true);
    expect(validRes.reservation?.id).toContain("AG-");

    // Tentativa de reserva conflitante para o mesmo veículo no mesmo horário -> Deve rejeitar
    const conflictRes = addVehicleReservation({
      plate: "ABC1D23",
      userId: "usr-02",
      userName: "Motorista B",
      start: validStart,
      end: validEnd,
      purpose: "Conflito de rota",
    });

    expect(conflictRes.success).toBe(false);
    expect(conflictRes.error).toContain("Já existe reserva ativa");
  });

  it("5. CAROLDO / M&F / HELOARTH: rateio proporcional da sede e apuração de resultado por contrato", () => {
    saveHQExpense("2026-11", 50000);
    saveContractRevenue("2026-11", "CT-001", 100000);
    saveContractRevenue("2026-11", "CT-005", 94000);

    const results = calculateCompanyResults("2026-11");
    expect(results.rows.length).toBeGreaterThanOrEqual(6);

    const ct1 = results.rows.find((r) => r.contractId === "CT-001");
    expect(ct1).toBeDefined();
    expect(ct1?.company).toBe("CAROLDO");
    expect(ct1?.revenue).toBe(100000);
    expect(ct1?.hqShareCost).toBeGreaterThan(0);
    expect(ct1?.totalCost).toBe(ct1!.laborCost + ct1!.fleetCost + ct1!.hqShareCost);
    expect(ct1?.netResult).toBe(ct1!.revenue! - ct1!.totalCost);

    // Comparativo entre as 3 empresas
    expect(COMPANIES.CAROLDO.name).toContain("Caroldo");
    expect(COMPANIES.MF.name).toContain("M&F");
    expect(COMPANIES.HELOARTH.name).toContain("Heloarth");
    expect(results.byCompany.CAROLDO.revenue).toBeGreaterThanOrEqual(100000);
    expect(results.byCompany.HELOARTH.revenue).toBeGreaterThanOrEqual(94000);
  });

  it("6. Módulos unificados: rotas de Frotas e Resultado registradas em AVAILABLE_MODULES", () => {
    const paths = AVAILABLE_MODULES.map((m) => m.path);
    expect(paths).toContain("/painel");
    expect(paths).toContain("/frotas");
    expect(paths).toContain("/frotas/veiculos");
    expect(paths).toContain("/frotas/manutencoes");
    expect(paths).toContain("/frotas/abastecimentos");
    expect(paths).toContain("/frotas/chamados");
    expect(paths).toContain("/frotas/agenda");
    expect(paths).toContain("/frotas/multas");
    expect(paths).toContain("/resultado");
  });
});

