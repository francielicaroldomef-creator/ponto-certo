import { describe, expect, it } from "vitest";
import {
  treatmentConflict,
  findConflictingTreatments,
  suggestNextFreeInterval,
  detectLegacyConflicts,
} from "@/lib/treatment-conflicts";

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

  it("findConflictingTreatments returns detailed conflict records with overlap duration", () => {
    const conflicts = findConflictingTreatments(shift, absence, coverage, [], [discount], true);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("discount");
    expect(conflicts[0].label).toContain("Sem cobertura");
    expect(conflicts[0].overlapMinutes).toBe(480); // 8h
  });

  describe("suggestNextFreeInterval", () => {
    it("suggests full shift when no treatment exists", () => {
      const sug = suggestNextFreeInterval(shift, absence, [], []);
      expect(sug.fullyCovered).toBe(false);
      expect(sug.start).toBe("08:00");
      expect(sug.end).toBe("17:00");
      expect(sug.pendingMinutes).toBe(480);
    });

    it("suggests 13:00–17:00 when morning 08:00–12:00 is already covered", () => {
      const morningCov = { ...shift, id: "c1", start_time: "08:00", end_time: "12:00", status: "realizada" };
      const sug = suggestNextFreeInterval(shift, absence, [morningCov], []);
      expect(sug.fullyCovered).toBe(false);
      expect(sug.start).toBe("13:00");
      expect(sug.end).toBe("17:00");
      expect(sug.pendingMinutes).toBe(240); // 4h
    });

    it("indicates fully covered when all shift hours are treated", () => {
      const fullCov = { ...shift, id: "c1", start_time: "08:00", end_time: "17:00", status: "realizada" };
      const sug = suggestNextFreeInterval(shift, absence, [fullCov], []);
      expect(sug.fullyCovered).toBe(true);
      expect(sug.pendingMinutes).toBe(0);
    });
  });

  describe("detectLegacyConflicts", () => {
    it("identifies overlapping active legacy records", () => {
      const cov1 = { ...shift, id: "c1", start_time: "08:00", end_time: "17:00", status: "realizada" };
      const cov2 = { ...shift, id: "c2", start_time: "13:00", end_time: "17:00", status: "realizada" };
      const legacy = detectLegacyConflicts(shift, absence, [cov1, cov2], []);
      expect(legacy).toHaveLength(1);
      expect(legacy[0].overlapMinutes).toBe(240);
      expect(legacy[0].id1).toBe("c1");
      expect(legacy[0].id2).toBe("c2");
    });

    it("ignores cancelled or inactive records", () => {
      const cov1 = { ...shift, id: "c1", start_time: "08:00", end_time: "17:00", status: "realizada" };
      const cov2 = { ...shift, id: "c2", start_time: "13:00", end_time: "17:00", status: "cancelada" };
      const legacy = detectLegacyConflicts(shift, absence, [cov1, cov2], []);
      expect(legacy).toHaveLength(0);
    });
  });
});