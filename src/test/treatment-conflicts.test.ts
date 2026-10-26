import { describe, expect, it } from "vitest";
import { treatmentConflict } from "@/lib/treatment-conflicts";

const shift = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const absence = { status: "falta_integral" as const };
const discount = { id: "discount", kind: "desconto", start_time: "08:00", end_time: "17:00" };
const coverage = { ...shift, id: "coverage", status: "realizada" };
describe("same absence treatment conflicts", () => {
  it("rejects 08–17 coverage over an 8h discount treatment", () => {
    expect(treatmentConflict(shift, absence, coverage, [], [discount], true)).toContain("Sem cobertura, com desconto");
  });
  it("rejects discount over existing coverage (reverse order)", () => {
    expect(treatmentConflict(shift, absence, discount, [coverage], [], false)).toContain("cobertura");
  });
  it("rejects duplicate coverages even for different people", () => {
    expect(treatmentConflict(shift, absence, { ...coverage, id: "other" }, [coverage], [], true)).toContain("cobertura");
  });
  it("rejects overlapping discount and waiver", () => {
    expect(treatmentConflict(shift, absence, { ...discount, id: "waiver", kind: "dispensa" }, [], [discount], false)).toContain("Edite ou cancele/remova");
  });
  it("allows distinct morning and afternoon periods", () => {
    expect(treatmentConflict(shift, absence, { ...coverage, start_time: "13:00" }, [], [{ ...discount, end_time: "12:00" }], true)).toBeNull();
  });
  it("allows self-edits of coverage and treatment", () => {
    expect(treatmentConflict(shift, absence, coverage, [coverage], [], true)).toBeNull();
    expect(treatmentConflict(shift, absence, discount, [], [discount], false)).toBeNull();
  });
  it("ignores cancelled coverage and inactive treatments", () => {
    expect(treatmentConflict(shift, absence, coverage, [{ ...coverage, id: "cancelled", status: "cancelada" }], [{ ...discount, active: false }], true)).toBeNull();
  });
  it("allows cancellation even in historically conflicting data", () => {
    expect(treatmentConflict(shift, absence, { ...coverage, status: "cancelada" }, [coverage], [discount], true)).toBeNull();
  });
  it("excludes lunch and respects partial absence", () => {
    expect(treatmentConflict(shift, absence, { ...coverage, start_time: "12:00", end_time: "13:00" }, [], [discount], true)).toBeNull();
    expect(treatmentConflict(shift, { status: "falta_parcial", absent_intervals: [{ start: "13:00", end: "17:00" }] }, { ...coverage, end_time: "12:00" }, [], [discount], true)).toBeNull();
  });
});