import { describe, expect, it } from "vitest";
import { addToTotals, computePostDay, emptyTotals, workIntervals, total, type AttendanceLike, type CoverageLike } from "@/lib/calc";

const S = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const HV = 22.5;
const full = (cov: CoverageLike[] = []) => cov;
const cov = (st: string, et: string, val: number, bs?: string, be?: string): CoverageLike => ({
  start_time: st, end_time: et, break_start: bs ?? null, break_end: be ?? null, status: "realizada", agreed_value: val,
});
const integral: AttendanceLike = { status: "falta_integral", hour_value: HV };
const partial: AttendanceLike = { status: "falta_parcial", hour_value: HV, absent_intervals: [{ start: "13:00", end: "17:00" }] };

describe("cálculos do contrato teste (05/10/2026)", () => {
  it("exclui o intervalo de almoço da jornada (8h)", () => {
    expect(total(workIntervals("08:00", "17:00", "12:00", "13:00"))).toBe(480);
  });
  it("falta integral sem cobertura gera desconto de R$ 180,00", () => {
    expect(computePostDay(S, integral, []).discountCents).toBe(18000);
  });
  it("falta parcial 13h-17h sem cobertura gera desconto de R$ 90,00", () => {
    expect(computePostDay(S, partial, []).discountCents).toBe(9000);
  });
  it("cobertura parcial 13h-15h deixa 2h descobertas (R$ 45,00) e custa R$ 32,50", () => {
    const r = computePostDay(S, partial, [cov("13:00", "15:00", 32.5)]);
    expect(r.uncoveredMin).toBe(120);
    expect(r.discountCents).toBe(4500);
    expect(r.coverageCostCents).toBe(3250);
  });
  it("coberturas sobrepostas não contam duas vezes", () => {
    const r = computePostDay(S, partial, [cov("13:00", "15:00", 32.5), cov("14:00", "16:00", 32.5)]);
    expect(r.coveredMin).toBe(180);
  });
  it("somente coberturas realizadas reduzem horas descobertas", () => {
    const r = computePostDay(S, integral, [{ ...cov("08:00", "17:00", 130, "12:00", "13:00"), status: "confirmada" }]);
    expect(r.uncoveredMin).toBe(480);
    expect(r.coverageCostCents).toBe(0);
  });
  it("folga não gera falta nem desconto", () => {
    expect(computePostDay(S, { status: "folga", hour_value: HV }, []).discountCents).toBe(0);
  });
  it("totais das seis ausências conferem com o esperado", () => {
    const t = emptyTotals();
    const fullCov = cov("08:00", "17:00", 130, "12:00", "13:00");
    const cases: [AttendanceLike, CoverageLike[]][] = [
      [integral, full()], [integral, [fullCov]], [integral, []], [integral, [fullCov]],
      [partial, []], [partial, [cov("13:00", "15:00", 32.5)]],
    ];
    for (const [a, c] of cases) addToTotals(t, a, computePostDay(S, a, c));
    expect(t.integral).toBe(4);
    expect(t.partial).toBe(2);
    expect(t.absentMin).toBe(40 * 60);
    expect(t.coveredMin).toBe(18 * 60);
    expect(t.uncoveredMin).toBe(22 * 60);
    expect(t.discountCents).toBe(49500);
    expect(t.coverageCostCents).toBe(29250);
    expect(t.impactCents).toBe(78750);
  });
});
