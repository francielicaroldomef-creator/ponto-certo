/**
 * company-results-store.ts — Módulo CAROLDO / M&F & Centros de Custo Unificados
 *
 * Consolida o resultado operacional e financeiro comparativo entre
 * CAROLDO PRESTAÇÃO DE SERVIÇOS e M&F PRESTAÇÃO DE SERVIÇOS, apurando:
 * - Custo de Pessoal direto por contrato
 * - Custo de Frota alocado no contrato
 * - Rateio das Despesas da Sede proporcional ao efetivo
 * - Receita mensal e Margem Líquida Operacional
 */

import { getFuelEntries, getMaintenanceOrders } from "./fleet-store";

export type OperatingCompany = "CAROLDO" | "MF" | "HELOARTH";

export interface CompanyInfo {
  code: OperatingCompany;
  name: string;
  cnpj: string;
  city: string;
}

export const COMPANIES: Record<OperatingCompany, CompanyInfo> = {
  CAROLDO: {
    code: "CAROLDO",
    name: "Caroldo Prestação de Serviços Ltda",
    cnpj: "12.345.678/0001-90",
    city: "Triunfo / RS",
  },
  MF: {
    code: "MF",
    name: "M&F Prestação de Serviços Ltda",
    cnpj: "98.765.432/0001-10",
    city: "Montenegro / RS",
  },
  HELOARTH: {
    code: "HELOARTH",
    name: "Heloarth Serviços e Gestão Ltda",
    cnpj: "45.678.901/0001-23",
    city: "Porto Alegre / RS",
  },
};

export interface ContractResultRow {
  contractId: string;
  contractDescription: string;
  company: OperatingCompany;
  headcount: number;
  laborCost: number;
  fleetCost: number;
  hqShareCost: number;
  totalCost: number;
  revenue: number | null;
  netResult: number | null;
  marginPercent: number | null;
}

const STORAGE_KEYS = {
  revenues: "caroldo_company_revenues",
  hqExpenses: "caroldo_company_hq_expenses",
  contractsMeta: "caroldo_company_contracts_meta",
};

export interface ContractMeta {
  id: string;
  description: string;
  company: OperatingCompany;
  headcount: number;
  laborCost: number;
}

const DEFAULT_CONTRACTS_META: ContractMeta[] = [
  { id: "CT-001", description: "Transporte e Apoio Operacional · Alfa", company: "CAROLDO", headcount: 14, laborCost: 38400 },
  { id: "CT-002", description: "Limpeza Industrial e Conservação · Beta", company: "MF", headcount: 18, laborCost: 46200 },
  { id: "CT-003", description: "Manutenção Predial e Portaria · Gama", company: "CAROLDO", headcount: 10, laborCost: 29500 },
  { id: "CT-004", description: "Apoio Logístico e Movimentação · Delta", company: "MF", headcount: 12, laborCost: 33800 },
  { id: "CT-005", description: "Serviços Especializados e Gestão · Heloarth", company: "HELOARTH", headcount: 15, laborCost: 41200 },
  { id: "CT-006", description: "Apoio Administrativo e Facilities · Heloarth", company: "HELOARTH", headcount: 8, laborCost: 22800 },
];

const DEFAULT_HQ_EXPENSES: Record<string, number> = {
  "2026-11": 42000,
  "2026-10": 41500,
};

const DEFAULT_REVENUES: Record<string, number> = {
  "2026-11|CT-001": 89000,
  "2026-11|CT-002": 105000,
  "2026-11|CT-003": 68000,
  "2026-11|CT-004": 79000,
  "2026-11|CT-005": 94000,
  "2026-11|CT-006": 58000,
  "2026-10|CT-001": 87500,
  "2026-10|CT-002": 102000,
  "2026-10|CT-005": 91500,
  "2026-10|CT-006": 56000,
};

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

export function getContractsMeta(): ContractMeta[] {
  return readStorage<ContractMeta[]>(STORAGE_KEYS.contractsMeta, DEFAULT_CONTRACTS_META);
}

export function getHQExpenses(competence: string): number {
  const all = readStorage<Record<string, number>>(STORAGE_KEYS.hqExpenses, DEFAULT_HQ_EXPENSES);
  return all[competence] ?? 40000;
}

export function saveHQExpense(competence: string, amount: number): void {
  const all = readStorage<Record<string, number>>(STORAGE_KEYS.hqExpenses, DEFAULT_HQ_EXPENSES);
  all[competence] = amount;
  writeStorage(STORAGE_KEYS.hqExpenses, all);
}

export function getContractRevenue(competence: string, contractId: string): number | null {
  const all = readStorage<Record<string, number>>(STORAGE_KEYS.revenues, DEFAULT_REVENUES);
  return all[`${competence}|${contractId}`] ?? null;
}

export function saveContractRevenue(competence: string, contractId: string, amount: number): void {
  const all = readStorage<Record<string, number>>(STORAGE_KEYS.revenues, DEFAULT_REVENUES);
  all[`${competence}|${contractId}`] = amount;
  writeStorage(STORAGE_KEYS.revenues, all);
}

/**
 * Calcula a consolidação completa de resultados por contrato e por empresa.
 */
export function calculateCompanyResults(competence: string): {
  rows: ContractResultRow[];
  totalRevenue: number;
  totalLabor: number;
  totalFleet: number;
  totalHQ: number;
  totalCost: number;
  netResult: number;
  overallMargin: number;
  byCompany: Record<OperatingCompany, { revenue: number; cost: number; result: number; margin: number }>;
} {
  const contracts = getContractsMeta();
  const totalHeadcount = contracts.reduce((acc, c) => acc + c.headcount, 0);
  const hqExpense = getHQExpenses(competence);

  // Custos de frota por contrato
  const fuelList = getFuelEntries().filter((f) => f.date.startsWith(competence));
  const maintList = getMaintenanceOrders().filter((m) => m.entry.startsWith(competence));

  const rows: ContractResultRow[] = contracts.map((c) => {
    // Frota estimada por contrato baseada nos abastecimentos e manutenções
    const fuelCost = fuelList
      .filter((f) => (c.id === "CT-001" ? ["ABC1D23", "GHI7J89", "NOP3Q45"].includes(f.plate) : ["DEF4G56", "JKL0M12"].includes(f.plate)))
      .reduce((sum, f) => sum + f.totalAmount, 0);

    const maintCost = maintList
      .filter((m) => (c.id === "CT-001" ? ["ABC1D23", "GHI7J89", "NOP3Q45"].includes(m.plate) : ["DEF4G56", "JKL0M12"].includes(m.plate)))
      .reduce((sum, m) => sum + m.amount, 0);

    const fleetCost = fuelCost + maintCost;
    const hqShare = totalHeadcount > 0 ? (hqExpense * c.headcount) / totalHeadcount : 0;
    const totalCost = c.laborCost + fleetCost + hqShare;
    const revenue = getContractRevenue(competence, c.id);
    const netResult = revenue !== null ? revenue - totalCost : null;
    const marginPercent = revenue !== null && revenue > 0 ? ((netResult ?? 0) / revenue) * 100 : null;

    return {
      contractId: c.id,
      contractDescription: c.description,
      company: c.company,
      headcount: c.headcount,
      laborCost: c.laborCost,
      fleetCost,
      hqShareCost: hqShare,
      totalCost,
      revenue,
      netResult,
      marginPercent,
    };
  });

  const totalRevenue = rows.reduce((acc, r) => acc + (r.revenue ?? 0), 0);
  const totalLabor = rows.reduce((acc, r) => acc + r.laborCost, 0);
  const totalFleet = rows.reduce((acc, r) => acc + r.fleetCost, 0);
  const totalHQ = hqExpense;
  const totalCost = totalLabor + totalFleet + totalHQ;
  const netResult = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;

  const byCompany: Record<OperatingCompany, { revenue: number; cost: number; result: number; margin: number }> = {
    CAROLDO: { revenue: 0, cost: 0, result: 0, margin: 0 },
    MF: { revenue: 0, cost: 0, result: 0, margin: 0 },
    HELOARTH: { revenue: 0, cost: 0, result: 0, margin: 0 },
  };

  for (const cmp of ["CAROLDO", "MF", "HELOARTH"] as OperatingCompany[]) {
    const cmpRows = rows.filter((r) => r.company === cmp);
    const rev = cmpRows.reduce((acc, r) => acc + (r.revenue ?? 0), 0);
    const cost = cmpRows.reduce((acc, r) => acc + r.totalCost, 0);
    const res = rev - cost;
    byCompany[cmp] = {
      revenue: rev,
      cost,
      result: res,
      margin: rev > 0 ? (res / rev) * 100 : 0,
    };
  }

  return {
    rows,
    totalRevenue,
    totalLabor,
    totalFleet,
    totalHQ,
    totalCost,
    netResult,
    overallMargin,
    byCompany,
  };
}

