import { describe, expect, it } from "vitest";
import { computePostDay, type AttendanceLike, type CoverageLike } from "@/lib/calc";

const S = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const falta: AttendanceLike = { status: "falta_integral", hour_value: 22.5 };
const cov = (st: string, et: string, val: number, bs?: string, be?: string): CoverageLike => ({
  start_time: st, end_time: et, break_start: bs ?? null, break_end: be ?? null, status: "realizada", agreed_value: val,
});
const t = (kind: string, start_time: string, end_time: string) => ({ kind, start_time, end_time });

describe("exemplos A–F de tratamento da ausência", () => {
  it("A: falta sem cobertura → R$ 180,00", () => {
    const r = computePostDay(S, falta, [], [t("desconto", "08:00", "12:00"), t("desconto", "13:00", "17:00")]);
    expect(r.discountCents).toBe(18000);
    expect(r.pendingMin).toBe(0);
  });
  it("B: diarista cobre 8h → desconto R$ 0,00, custo R$ 130,00", () => {
    const r = computePostDay(S, falta, [cov("08:00", "17:00", 130, "12:00", "13:00")]);
    expect(r.discountCents).toBe(0);
    expect(r.coverageCostCents).toBe(13000);
  });
  it("C: diarista cobre 4h → 4h a descontar, R$ 90,00", () => {
    const r = computePostDay(S, falta, [cov("08:00", "12:00", 65)], [t("desconto", "13:00", "17:00")]);
    expect(r.uncoveredMin).toBe(240);
    expect(r.discountCents).toBe(9000);
    expect(r.coverageCostCents).toBe(6500);
  });
  it("D: supervisor cobre 8h → desconto e custo R$ 0,00", () => {
    const r = computePostDay(S, falta, [cov("08:00", "17:00", 0, "12:00", "13:00")]);
    expect(r.discountCents).toBe(0);
    expect(r.coverageCostCents).toBe(0);
  });
  it("E: dispensa integral → falta mantida, desconto e custo R$ 0,00", () => {
    const r = computePostDay(S, falta, [], [t("dispensa", "08:00", "17:00")]);
    expect(r.absentMin).toBe(480);
    expect(r.waivedMin).toBe(480);
    expect(r.coveredMin).toBe(0);
    expect(r.discountCents).toBe(0);
    expect(r.coverageCostCents).toBe(0);
  });
  it("F: 4h cobertura + 2h dispensa + 2h descobertas → R$ 45,00", () => {
    const r = computePostDay(S, falta, [cov("08:00", "12:00", 65)], [t("dispensa", "13:00", "15:00"), t("desconto", "15:00", "17:00")]);
    expect(r.coveredMin).toBe(240);
    expect(r.waivedMin).toBe(120);
    expect(r.uncoveredMin).toBe(120);
    expect(r.discountCents).toBe(4500);
    expect(r.pendingMin).toBe(0);
  });
  it("horas sem tratamento ficam pendentes", () => {
    expect(computePostDay(S, falta, [cov("08:00", "12:00", 65)]).pendingMin).toBe(240);
  });
});
