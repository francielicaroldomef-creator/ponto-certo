import { describe, it, expect } from "vitest";
import { validCpf, dayTotal, repeatedDay, type DayEntry } from "../lib/day-control";
const row: DayEntry = { id: "existing", code: "DIA-000001", contract_id: "contract", absent_name: "Teste", absent_cpf: "52998224725", worker_name: "Teste 2", worker_cpf: "11144477735", work_date: "2026-11-11", shift: "integral", daily_value: 130, fare_value: 5.5, fare_quantity: 2, total_value: 141, active: true };
describe("Controle de dias", () => {
  it("exige CPF válido de ambas as pessoas", () => { expect(validCpf("529.982.247-25")).toBe(true); expect(validCpf("11144477735")).toBe(true); expect(validCpf("11111111111")).toBe(false); expect(validCpf("52998224726")).toBe(false); expect(validCpf("")).toBe(false); });
  it("soma diária com valor unitário vezes quantidade de passagens", () => { expect(dayTotal(130, 5.5, 2)).toBe(141); expect(dayTotal(65, 0, 0)).toBe(65); expect(dayTotal(0.1, 0.2, 3)).toBe(0.7); });
  it("bloqueia diária repetida pelo CPF da diarista mesmo com outro nome", () => { expect(repeatedDay([row], { ...row, id: "new", worker_cpf: "111.444.777-35", absent_cpf: "other" })?.id).toBe("existing"); });
  it("bloqueia substituições repetidas da faltante", () => { expect(repeatedDay([row], { ...row, id: "new", worker_cpf: "other" })?.id).toBe("existing"); });
  it("dia inteiro bloqueia os dois meios turnos", () => { for (const shift of ["manha", "tarde"] as const) expect(repeatedDay([row], { ...row, id: "new", shift })?.id).toBe("existing"); });
  it("permite manhã e tarde distintas", () => { expect(repeatedDay([{ ...row, shift: "manha" }], { ...row, id: "new", shift: "tarde" })).toBeUndefined(); });
  it("permite outra data", () => { expect(repeatedDay([row], { ...row, id: "new", work_date: "2026-11-12" })).toBeUndefined(); });
  it("permite editar o próprio lançamento", () => { expect(repeatedDay([row], row)).toBeUndefined(); });
  it("cancelados não bloqueiam", () => { expect(repeatedDay([{ ...row, active: false }], { ...row, id: "new" })).toBeUndefined(); });
});