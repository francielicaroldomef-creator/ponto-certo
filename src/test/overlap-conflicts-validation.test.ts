import { describe, expect, it } from "vitest";
import { treatmentConflict, type TreatmentRecord } from "@/lib/treatment-conflicts";

const shift = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const falta8h = { status: "falta_integral" as const, hour_value: 22.5 };

describe("Item 2: Bloqueio de Sobreposição na Interface (Teste de Conflito)", () => {
  it("2.1 Tentativa de Tratamento Duplicado: cobertura 08h-17h contra 'Sem cobertura, com desconto' existente", () => {
    const descontoExistente: TreatmentRecord = {
      id: "treatment-desconto-1",
      kind: "desconto",
      start_time: "08:00",
      end_time: "17:00",
      active: true,
    };
    const novaCobertura: TreatmentRecord = {
      id: "new-cov-1",
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
    };

    const conflito = treatmentConflict(shift, falta8h, novaCobertura, [], [descontoExistente], true);
    expect(conflito).not.toBeNull();
    expect(conflito).toContain("Conflito com Sem cobertura, com desconto (08:00–17:00) da mesma ausência");
    expect(conflito).toContain("Edite ou cancele/remova o tratamento anterior antes de salvar este período.");
  });

  it("2.1 Tentativa de Tratamento Duplicado: desconto contra cobertura de diarista existente no mesmo horário", () => {
    const coberturaExistente: TreatmentRecord = {
      id: "cov-diarista-1",
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
    };
    const novoDesconto: TreatmentRecord = {
      id: "new-treatment-1",
      kind: "desconto",
      start_time: "08:00",
      end_time: "17:00",
      active: true,
    };

    const conflito = treatmentConflict(shift, falta8h, novoDesconto, [coberturaExistente], [], false);
    expect(conflito).not.toBeNull();
    expect(conflito).toContain("Conflito com cobertura (08:00–17:00) da mesma ausência");
  });

  it("2.2 Ajuste e Edição do Próprio Registro (Autoedição de Cobertura): alterar horários ou trocar diarista não trava como falso conflito", () => {
    const coberturaExistente: TreatmentRecord = {
      id: "cov-123",
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
    };
    // Edição do próprio registro para 08:00–12:00
    const autoEdicao: TreatmentRecord = {
      id: "cov-123",
      start_time: "08:00",
      end_time: "12:00",
      break_start: null,
      break_end: null,
      status: "realizada",
    };

    const conflito = treatmentConflict(shift, falta8h, autoEdicao, [coberturaExistente], [], true);
    expect(conflito).toBeNull();
  });

  it("2.2 Ajuste e Edição do Próprio Registro (Autoedição de Tratamento/Dispensa): alterar dados com mesmo id é permitido", () => {
    const dispensaExistente: TreatmentRecord = {
      id: "disp-456",
      kind: "dispensa",
      start_time: "08:00",
      end_time: "12:00",
      active: true,
    };
    const autoEdicaoDispensa: TreatmentRecord = {
      id: "disp-456",
      kind: "dispensa",
      start_time: "08:00",
      end_time: "11:00",
      active: true,
    };

    const conflito = treatmentConflict(shift, falta8h, autoEdicaoDispensa, [], [dispensaExistente], false);
    expect(conflito).toBeNull();
  });
});
