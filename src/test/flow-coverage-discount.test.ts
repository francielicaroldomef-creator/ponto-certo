import { describe, expect, it } from "vitest";
import { computePostDay, type AttendanceLike, type CoverageLike, type TreatmentLike } from "@/lib/calc";

const shift = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const falta8h: AttendanceLike = { status: "falta_integral", hour_value: 22.5 };

describe("Item 1: Fluxo de Cobertura e Desconto em Tempo Real na Interface", () => {
  it("1.1 Cobertura Integral: falta 8h sem cobertura gera R$ 180,00 de desconto", () => {
    const semTratamento = computePostDay(shift, falta8h, []);
    expect(semTratamento.absentMin).toBe(480);
    expect(semTratamento.uncoveredMin).toBe(480);
    expect(semTratamento.discountCents).toBe(18000); // R$ 180,00
    expect(semTratamento.coverageCostCents).toBe(0);
    expect(semTratamento.pendingMin).toBe(480);
  });

  it("1.1 Cobertura Integral lançada: desconto zera imediatamente (R$ 0,00) e custo passa a R$ 130,00", () => {
    const diaristaTurnoCompleto: CoverageLike = {
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
      agreed_value: 130.0,
    };

    const comCobertura = computePostDay(shift, falta8h, [diaristaTurnoCompleto]);
    expect(comCobertura.absentMin).toBe(480);
    expect(comCobertura.coveredMin).toBe(480);
    expect(comCobertura.uncoveredMin).toBe(0);
    expect(comCobertura.discountCents).toBe(0); // R$ 0,00 imediato
    expect(comCobertura.coverageCostCents).toBe(13000); // R$ 130,00
    expect(comCobertura.pendingMin).toBe(0);
  });

  it("1.2 Cobertura Parcial e Casos Mistos: falta 8h, 4h cobertura + 2h dispensa tomador -> restam 2h a descontar com valor de R$ 45,00", () => {
    // 4h de cobertura (08:00–12:00)
    const cov4h: CoverageLike = {
      start_time: "08:00",
      end_time: "12:00",
      status: "realizada",
      agreed_value: 65.0,
    };
    // 2h de dispensa autorizada pelo cliente (13:00–15:00)
    const dispensa2h: TreatmentLike = {
      kind: "dispensa",
      start_time: "13:00",
      end_time: "15:00",
      active: true,
    };
    // 2h com desconto confirmado (15:00–17:00)
    const desconto2h: TreatmentLike = {
      kind: "desconto",
      start_time: "15:00",
      end_time: "17:00",
      active: true,
    };

    const misto = computePostDay(shift, falta8h, [cov4h], [dispensa2h, desconto2h]);
    expect(misto.absentMin).toBe(480); // 8h de falta
    expect(misto.coveredMin).toBe(240); // 4h cobertas
    expect(misto.waivedMin).toBe(120); // 2h dispensadas
    expect(misto.uncoveredMin).toBe(120); // 2h descobertas
    expect(misto.discountCents).toBe(4500); // 2h * R$ 22,50 = R$ 45,00 exatos
    expect(misto.coverageCostCents).toBe(6500); // R$ 65,00 da cobertura parcial
    expect(misto.pendingMin).toBe(0); // tudo tratado
  });

  it("1.3 Cancelamento de Cobertura: ao cancelar cobertura, desconto é recalculado e restabelecido para R$ 180,00", () => {
    const diaristaCancelada: CoverageLike = {
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "cancelada", // cancelada
      agreed_value: 130.0,
    };

    const posCancelamento = computePostDay(shift, falta8h, [diaristaCancelada]);
    // Cobertura cancelada não deve abater horas nem gerar custo
    expect(posCancelamento.coveredMin).toBe(0);
    expect(posCancelamento.uncoveredMin).toBe(480);
    expect(posCancelamento.discountCents).toBe(18000); // R$ 180,00 restabelecido
    expect(posCancelamento.coverageCostCents).toBe(0); // Custo zerado
  });

  it("1.4 Nova Cobertura via Menu de Coberturas vinculada ao posto reflete na apuração do posto", () => {
    // Nova cobertura cadastrada de forma desvinculada ou vinculada diretamente ao posto
    const covMenu: CoverageLike = {
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
      agreed_value: 130.0,
    };

    const res = computePostDay(shift, falta8h, [covMenu]);
    expect(res.coveredMin).toBe(480);
    expect(res.discountCents).toBe(0);
    expect(res.coverageCostCents).toBe(13000);
  });
});
