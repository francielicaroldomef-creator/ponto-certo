export type DayShift = "integral" | "manha" | "tarde";
export const SHIFT_LABEL: Record<DayShift, string> = { integral: "Dia inteiro", manha: "Meio turno — manhã", tarde: "Meio turno — tarde" };
export function normalizeCpf(value: string): string { return value.replace(/\D/g, ""); }
export function validCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const digit = (sum * 10 % 11) % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}
export function moneyNumber(value: string | number): number { return Number(String(value).replace(",", ".")); }
export function dayTotal(daily: number, fare: number, quantity: number): number {
  return (Math.round(daily * 100) + Math.round(fare * 100) * quantity) / 100;
}
export function shiftsOverlap(a: DayShift, b: DayShift): boolean { return a === "integral" || b === "integral" || a === b; }
export interface DayEntry {
  id: string; code: string; contract_id: string; absent_name: string; absent_cpf: string;
  worker_name: string; worker_cpf: string; work_date: string; shift: DayShift;
  daily_value: number; fare_value: number; fare_quantity: number; total_value: number; active: boolean;
}
export function repeatedDay(entries: DayEntry[], candidate: Pick<DayEntry, "id" | "worker_cpf" | "absent_cpf" | "work_date" | "shift">): DayEntry | undefined {
  return entries.find(r => r.active && r.id !== candidate.id && r.work_date === candidate.work_date &&
    (normalizeCpf(r.worker_cpf) === normalizeCpf(candidate.worker_cpf) || normalizeCpf(r.absent_cpf) === normalizeCpf(candidate.absent_cpf)) && shiftsOverlap(r.shift, candidate.shift));
}
export function maskedCpf(value: string): string { return `***.***.***-${normalizeCpf(value).slice(-2)}`; }