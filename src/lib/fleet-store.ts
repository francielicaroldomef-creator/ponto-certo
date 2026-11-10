/**
 * fleet-store.ts — Módulo Unificado de Gestão de Frotas Caroldo
 *
 * Armazena e gerencia o ciclo completo de veículos, ordens de manutenção,
 * controle de abastecimento, solicitações de motoristas, agenda de reservas
 * e multas/infrações, com persistência e histórico integrado.
 */

export interface Vehicle {
  plate: string;
  model: string;
  driver: string;
  odometer: number;
  consumptionKmPerL: number;
  status: "Disponível" | "Em uso" | "Em manutenção" | "Indisponível";
  contractId: string;
  year?: number | undefined;
  fuelType?: string | undefined;
}

export interface MaintenanceOrder {
  id: string;
  plate: string;
  workshop: string;
  service: string;
  entry: string; // ISO date or YYYY-MM-DDTHH:mm
  exit?: string | undefined;
  status: "Em manutenção" | "Saiu da oficina e não faturado" | "Saiu da oficina" | "Aguardando peças";
  amount: number;
  payment: "Pendente de pagamento" | "Pago";
  paidAt?: string | undefined;
  invoiceNumber?: string | undefined;
  invoiceFile?: string | undefined;
  proofFile?: string | undefined;
  history: { at: string; text: string }[];
}

export interface FuelEntry {
  id: string;
  date: string;
  plate: string;
  odometer: number;
  liters: number;
  totalAmount: number;
  pricePerLiter: number;
  fullTank: boolean;
  driver?: string | undefined;
}

export interface MaintenanceTicket {
  id: string;
  plate: string;
  driver: string;
  text: string;
  priority: "Normal" | "Urgente" | "Veículo parado" | "Emergência";
  status: "Em análise" | "Agendado" | "Concluído";
  createdAt: string;
  contractId?: string | undefined;
}

export interface VehicleReservation {
  id: string;
  plate: string;
  userId: string;
  userName: string;
  start: string;
  end: string;
  purpose: string;
  destination?: string | undefined;
  passengers?: number | undefined;
  state: "Agendado" | "Cancelado";
  cancelReason?: string | undefined;
  createdAt: string;
  contractId?: string | undefined;
}

export interface TrafficFine {
  id: string;
  plate: string;
  infraction: string;
  agency: string;
  amount: number;
  dueDate: string;
  status: "Pendente" | "Pago";
  driver?: string | undefined;
}

const STORAGE_KEYS = {
  vehicles: "caroldo_fleet_vehicles",
  maintenance: "caroldo_fleet_maintenance",
  fuel: "caroldo_fleet_fuel",
  tickets: "caroldo_fleet_tickets",
  reservations: "caroldo_fleet_reservations",
  fines: "caroldo_fleet_fines",
};

const INITIAL_VEHICLES: Vehicle[] = [
  { plate: "ABC1D23", model: "Fiat Ducato Maxi · 2022", driver: "Carlos Silva", odometer: 84320, consumptionKmPerL: 8.9, status: "Disponível", contractId: "CT-001", year: 2022, fuelType: "Diesel S10" },
  { plate: "DEF4G56", model: "Mercedes-Benz Sprinter 416 · 2021", driver: "João Santos", odometer: 112450, consumptionKmPerL: 9.2, status: "Em manutenção", contractId: "CT-002", year: 2021, fuelType: "Diesel S10" },
  { plate: "GHI7J89", model: "Renault Master Furgão · 2023", driver: "Marcos Oliveira", odometer: 67800, consumptionKmPerL: 9.8, status: "Em uso", contractId: "CT-001", year: 2023, fuelType: "Diesel S10" },
  { plate: "JKL0M12", model: "Fiat Ducato Minibus · 2020", driver: "Paulo Souza", odometer: 143120, consumptionKmPerL: 8.5, status: "Disponível", contractId: "CT-002", year: 2020, fuelType: "Diesel S10" },
  { plate: "NOP3Q45", model: "Mercedes-Benz Sprinter 516 · 2022", driver: "André Lima", odometer: 91650, consumptionKmPerL: 9.4, status: "Em uso", contractId: "CT-001", year: 2022, fuelType: "Diesel S10" },
  { plate: "QRS6T78", model: "Iveco Daily City 30-130 · 2023", driver: "Fernando Rocha", odometer: 45200, consumptionKmPerL: 9.1, status: "Disponível", contractId: "CT-001", year: 2023, fuelType: "Diesel S10" },
  { plate: "UVW9X01", model: "Renault Master L3H2 · 2022", driver: "Roberto Alves", odometer: 78400, consumptionKmPerL: 8.8, status: "Disponível", contractId: "CT-002", year: 2022, fuelType: "Diesel S10" },
];

const INITIAL_MAINTENANCE: MaintenanceOrder[] = [
  {
    id: "OM-1001",
    plate: "DEF4G56",
    workshop: "Oficina Central Triunfo",
    service: "Revisão preventiva geral e sistema de freios",
    entry: "2026-11-03T08:30",
    status: "Em manutenção",
    amount: 1500,
    payment: "Pendente de pagamento",
    history: [
      { at: "2026-11-03T08:30", text: "Entrada na oficina registrada. Pagamento pendente." },
    ],
  },
  {
    id: "OM-1002",
    plate: "ABC1D23",
    workshop: "Auto Mecânica Triunfo",
    service: "Troca de óleo sintético 5W30, filtro de óleo e filtro de combustível",
    entry: "2026-10-15T09:00",
    exit: "2026-10-15T16:00",
    status: "Saiu da oficina",
    amount: 650,
    payment: "Pago",
    paidAt: "2026-10-16T11:20",
    invoiceNumber: "NF-8921",
    proofFile: "comprovante_pix_om1002.pdf",
    history: [
      { at: "2026-10-15T09:00", text: "Entrada para troca de óleo preventiva." },
      { at: "2026-10-15T16:00", text: "Serviço concluído e veículo liberado." },
      { at: "2026-10-16T11:20", text: "Pagamento confirmado via PIX." },
    ],
  },
  {
    id: "OM-1003",
    plate: "JKL0M12",
    workshop: "Oficina Central Triunfo",
    service: "Substituição de pastilhas de freio e sangria",
    entry: "2026-11-08T10:00",
    exit: "2026-11-09T17:30",
    status: "Saiu da oficina e não faturado",
    amount: 890,
    payment: "Pendente de pagamento",
    history: [
      { at: "2026-11-08T10:00", text: "Entrada na oficina para revisão de freios." },
      { at: "2026-11-09T17:30", text: "Veículo liberado para operação. Nota fiscal e pagamento pendentes." },
    ],
  },
];

const INITIAL_FUEL: FuelEntry[] = [
  { id: "ABAST-01", date: "2026-11-05", plate: "ABC1D23", odometer: 84320, liters: 65, totalAmount: 409.5, pricePerLiter: 6.3, fullTank: true, driver: "Carlos Silva" },
  { id: "ABAST-02", date: "2026-11-04", plate: "GHI7J89", odometer: 67800, liters: 58, totalAmount: 365.4, pricePerLiter: 6.3, fullTank: true, driver: "Marcos Oliveira" },
  { id: "ABAST-03", date: "2026-11-04", plate: "NOP3Q45", odometer: 91650, liters: 40, totalAmount: 252.0, pricePerLiter: 6.3, fullTank: false, driver: "André Lima" },
  { id: "ABAST-04", date: "2026-11-02", plate: "DEF4G56", odometer: 112100, liters: 70, totalAmount: 439.6, pricePerLiter: 6.28, fullTank: true, driver: "João Santos" },
  { id: "ABAST-05", date: "2026-11-01", plate: "JKL0M12", odometer: 142600, liters: 55, totalAmount: 345.95, pricePerLiter: 6.29, fullTank: true, driver: "Paulo Souza" },
];

const INITIAL_TICKETS: MaintenanceTicket[] = [
  { id: "CH-1042", plate: "ABC1D23", driver: "Carlos Silva", text: "Ruído no sistema de freios dianteiros ao acionar o pedal", priority: "Urgente", status: "Em análise", createdAt: "2026-11-09T14:20" },
  { id: "CH-1041", plate: "DEF4G56", driver: "João Santos", text: "Revisão periódica do sistema de ar-condicionado da van", priority: "Normal", status: "Agendado", createdAt: "2026-11-02T10:15" },
  { id: "CH-1040", plate: "JKL0M12", driver: "Paulo Souza", text: "Alinhamento e balanceamento devido a trepidação acima de 80 km/h", priority: "Normal", status: "Concluído", createdAt: "2026-10-28T16:00" },
];

const INITIAL_RESERVATIONS: VehicleReservation[] = [
  { id: "AG-0001", plate: "ABC1D23", userId: "usr-carlos", userName: "Carlos Silva", start: "2026-11-12T08:00", end: "2026-11-12T17:00", purpose: "Transporte de colaboradores turno manhã", destination: "Polo Petroquímico Triunfo", passengers: 6, state: "Agendado", createdAt: "2026-11-09T08:00", contractId: "CT-001" },
  { id: "AG-0002", plate: "GHI7J89", userId: "usr-marcos", userName: "Marcos Oliveira", start: "2026-11-13T13:00", end: "2026-11-13T19:00", purpose: "Inspeção e apoio operacional nos postos", destination: "Montenegro / RS", passengers: 3, state: "Agendado", createdAt: "2026-11-09T10:00", contractId: "CT-001" },
];

const INITIAL_FINES: TrafficFine[] = [
  { id: "MULTA-01", plate: "JKL0M12", infraction: "Transitar em velocidade superior à máxima em até 20%", agency: "Detran RS / PRF", amount: 130.16, dueDate: "2026-11-20", status: "Pendente", driver: "Paulo Souza" },
  { id: "MULTA-02", plate: "NOP3Q45", infraction: "Estacionamento em desacordo com a regulamentação local", agency: "EPTC / Detran RS", amount: 195.23, dueDate: "2026-11-28", status: "Pendente", driver: "André Lima" },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Ações de Veículos
// ---------------------------------------------------------------------------
export function getVehicles(): Vehicle[] {
  return readStorage<Vehicle[]>(STORAGE_KEYS.vehicles, INITIAL_VEHICLES);
}

export function saveVehicle(vehicle: Vehicle): Vehicle[] {
  const current = getVehicles();
  const idx = current.findIndex((v) => v.plate === vehicle.plate);
  if (idx >= 0) {
    current[idx] = vehicle;
  } else {
    current.unshift(vehicle);
  }
  writeStorage(STORAGE_KEYS.vehicles, current);
  return current;
}

// ---------------------------------------------------------------------------
// Ações de Manutenção
// ---------------------------------------------------------------------------
export function getMaintenanceOrders(): MaintenanceOrder[] {
  return readStorage<MaintenanceOrder[]>(STORAGE_KEYS.maintenance, INITIAL_MAINTENANCE);
}

export function saveMaintenanceOrder(order: MaintenanceOrder): MaintenanceOrder[] {
  const current = getMaintenanceOrders();
  const idx = current.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    current[idx] = order;
  } else {
    current.unshift(order);
  }
  writeStorage(STORAGE_KEYS.maintenance, current);

  // Atualiza status do veículo associado
  const vehicles = getVehicles();
  const v = vehicles.find((x) => x.plate === order.plate);
  if (v) {
    if (order.status === "Em manutenção") {
      v.status = "Em manutenção";
    } else if (order.status === "Saiu da oficina" || order.status === "Saiu da oficina e não faturado") {
      v.status = "Disponível";
    }
    saveVehicle(v);
  }

  return current;
}

// ---------------------------------------------------------------------------
// Ações de Abastecimento
// ---------------------------------------------------------------------------
export function getFuelEntries(): FuelEntry[] {
  return readStorage<FuelEntry[]>(STORAGE_KEYS.fuel, INITIAL_FUEL);
}

export function addFuelEntry(entry: Omit<FuelEntry, "id">): FuelEntry {
  const current = getFuelEntries();
  const item: FuelEntry = {
    ...entry,
    id: `ABAST-${String(current.length + 1).padStart(2, "0")}`,
  };
  current.unshift(item);
  writeStorage(STORAGE_KEYS.fuel, current);

  // Atualiza hodômetro do veículo
  const vehicles = getVehicles();
  const v = vehicles.find((x) => x.plate === entry.plate);
  if (v && entry.odometer > v.odometer) {
    v.odometer = entry.odometer;
    saveVehicle(v);
  }

  return item;
}

// ---------------------------------------------------------------------------
// Ações de Chamados
// ---------------------------------------------------------------------------
export function getMaintenanceTickets(): MaintenanceTicket[] {
  return readStorage<MaintenanceTicket[]>(STORAGE_KEYS.tickets, INITIAL_TICKETS);
}

export function addMaintenanceTicket(ticket: Omit<MaintenanceTicket, "id" | "createdAt">): MaintenanceTicket {
  const current = getMaintenanceTickets();
  const item: MaintenanceTicket = {
    ...ticket,
    id: `CH-${1043 + current.length}`,
    createdAt: new Date().toISOString(),
  };
  current.unshift(item);
  writeStorage(STORAGE_KEYS.tickets, current);
  return item;
}

export function updateTicketStatus(id: string, status: MaintenanceTicket["status"]): MaintenanceTicket[] {
  const current = getMaintenanceTickets();
  const t = current.find((x) => x.id === id);
  if (t) {
    t.status = status;
    writeStorage(STORAGE_KEYS.tickets, current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Ações de Reservas / Agenda
// ---------------------------------------------------------------------------
export function getVehicleReservations(): VehicleReservation[] {
  return readStorage<VehicleReservation[]>(STORAGE_KEYS.reservations, INITIAL_RESERVATIONS);
}

export function addVehicleReservation(res: Omit<VehicleReservation, "id" | "createdAt" | "state">): { success: boolean; error?: string; reservation?: VehicleReservation } {
  const current = getVehicleReservations();

  // Validação: antecedência mínima de 24h
  const startTime = new Date(res.start).getTime();
  const now = Date.now();
  if (startTime - now < 24 * 60 * 60 * 1000) {
    return { success: false, error: "Agendamentos exigem antecedência mínima de 24 horas da retirada." };
  }

  // Validação: conflito de horário
  const conflict = current.find(
    (r) =>
      r.plate === res.plate &&
      r.state === "Agendado" &&
      res.start < r.end &&
      res.end > r.start
  );
  if (conflict) {
    return { success: false, error: `Já existe reserva ativa para o veículo ${res.plate} neste horário (${conflict.start} às ${conflict.end}).` };
  }

  const item: VehicleReservation = {
    ...res,
    id: `AG-${String(current.length + 1).padStart(4, "0")}`,
    state: "Agendado",
    createdAt: new Date().toISOString(),
  };

  current.unshift(item);
  writeStorage(STORAGE_KEYS.reservations, current);
  return { success: true, reservation: item };
}

export function cancelVehicleReservation(id: string, reason: string): { success: boolean; error?: string } {
  const current = getVehicleReservations();
  const res = current.find((r) => r.id === id);
  if (!res) return { success: false, error: "Reserva não encontrada." };

  const startTime = new Date(res.start).getTime();
  const now = Date.now();
  if (startTime - now < 24 * 60 * 60 * 1000) {
    return { success: false, error: "Cancelamento bloqueado: prazo limite de antecedência de 24 horas expirado." };
  }

  res.state = "Cancelado";
  res.cancelReason = reason.trim();
  writeStorage(STORAGE_KEYS.reservations, current);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ações de Multas
// ---------------------------------------------------------------------------
export function getTrafficFines(): TrafficFine[] {
  return readStorage<TrafficFine[]>(STORAGE_KEYS.fines, INITIAL_FINES);
}

export function markFinePaid(id: string): TrafficFine[] {
  const current = getTrafficFines();
  const f = current.find((x) => x.id === id);
  if (f) {
    f.status = "Pago";
    writeStorage(STORAGE_KEYS.fines, current);
  }
  return current;
}
