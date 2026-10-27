import { describe, expect, it } from "vitest";
import {
  findConflictingTreatments,
  treatmentConflict,
  suggestNextFreeInterval,
  detectLegacyConflicts,
  type TreatmentRecord,
} from "@/lib/treatment-conflicts";
import { computePostDay } from "@/lib/calc";

const shift = {
  start_time: "08:00",
  end_time: "17:00",
  break_start: "12:00",
  break_end: "13:00",
};
const fullAbsence = { status: "falta_integral" as const, hour_value: 22.5 };

describe("Otimização da Resolução de Conflitos e Tratamentos de Ausência", () => {
  describe("1. Sugestão Inteligente de Horários Livres (Preenchimento Automático)", () => {
    it("pré-preenche a escala integral quando a ausência ainda não possui tratamentos", () => {
      const suggestion = suggestNextFreeInterval(shift, fullAbsence, [], []);
      expect(suggestion.fullyCovered).toBe(false);
      expect(suggestion.start).toBe("08:00");
      expect(suggestion.end).toBe("17:00");
      expect(suggestion.pendingMinutes).toBe(480); // 8h
    });

    it("pré-preenche 13:00–17:00 quando 08:00–12:00 já está coberto", () => {
      const morningCov: TreatmentRecord = {
        id: "cov-morning",
        start_time: "08:00",
        end_time: "12:00",
        status: "realizada",
        coverer_type: "diarista",
      };
      const suggestion = suggestNextFreeInterval(shift, fullAbsence, [morningCov], []);
      expect(suggestion.fullyCovered).toBe(false);
      expect(suggestion.start).toBe("13:00");
      expect(suggestion.end).toBe("17:00");
      expect(suggestion.pendingMinutes).toBe(240); // 4h
    });

    it("pré-preenche 15:00–17:00 quando 08:00–12:00 está coberto e 13:00–15:00 está dispensado", () => {
      const morningCov: TreatmentRecord = {
        id: "cov-morning",
        start_time: "08:00",
        end_time: "12:00",
        status: "realizada",
      };
      const afternoonWaiver: TreatmentRecord = {
        id: "waiver-afternoon",
        start_time: "13:00",
        end_time: "15:00",
        kind: "dispensa",
        active: true,
      };
      const suggestion = suggestNextFreeInterval(shift, fullAbsence, [morningCov], [afternoonWaiver]);
      expect(suggestion.fullyCovered).toBe(false);
      expect(suggestion.start).toBe("15:00");
      expect(suggestion.end).toBe("17:00");
      expect(suggestion.pendingMinutes).toBe(120); // 2h restantes
    });

    it("sinaliza ausência 100% contemplada quando toda a jornada foi tratada", () => {
      const fullCov: TreatmentRecord = {
        id: "cov-full",
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
      };
      const suggestion = suggestNextFreeInterval(shift, fullAbsence, [fullCov], []);
      expect(suggestion.fullyCovered).toBe(true);
      expect(suggestion.pendingMinutes).toBe(0);
      expect(suggestion.pendingIntervals).toHaveLength(0);
    });
  });

  describe("2. Ação de Substituição Rápida (Substituir com 1 Clique)", () => {
    it("identifica conflito detalhado ao tentar registrar cobertura sobre desconto prévio", () => {
      const existingDiscount: TreatmentRecord = {
        id: "desc-1",
        start_time: "08:00",
        end_time: "17:00",
        kind: "desconto",
        active: true,
      };
      const candidateCoverage: TreatmentRecord = {
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
        coverer_type: "diarista",
      };

      const conflicts = findConflictingTreatments(shift, fullAbsence, candidateCoverage, [], [existingDiscount], true);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe("desc-1");
      expect(conflicts[0].label).toContain("Sem cobertura");
      expect(conflicts[0].overlapMinutes).toBe(480);
    });

    it("permite salvar a nova cobertura sem erro após inativar/cancelar o tratamento conflitante", () => {
      const existingDiscount: TreatmentRecord = {
        id: "desc-1",
        start_time: "08:00",
        end_time: "17:00",
        kind: "desconto",
        active: true,
      };
      const candidateCoverage: TreatmentRecord = {
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
        coverer_type: "diarista",
      };

      // Antes da inativação: há conflito
      expect(treatmentConflict(shift, fullAbsence, candidateCoverage, [], [existingDiscount], true)).not.toBeNull();

      // Simulação da ação 'Sim, substituir agora': inativar o registro anterior (active = false)
      const deactivatedDiscount: TreatmentRecord = { ...existingDiscount, active: false };

      // Após a inativação: não há mais conflito
      expect(treatmentConflict(shift, fullAbsence, candidateCoverage, [], [deactivatedDiscount], true)).toBeNull();
    });

    it("permite trocar cobertura por diarista por dispensa do tomador via substituição", () => {
      const existingCov: TreatmentRecord = {
        id: "cov-1",
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
        coverer_type: "diarista",
      };
      const newWaiver: TreatmentRecord = {
        start_time: "08:00",
        end_time: "17:00",
        kind: "dispensa",
        active: true,
      };

      // Com cobertura ativa: conflita
      const conflicts = findConflictingTreatments(shift, fullAbsence, newWaiver, [existingCov], [], false);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe("cov-1");

      // Cancelando a cobertura (status = 'cancelada')
      const cancelledCov: TreatmentRecord = { ...existingCov, status: "cancelada" };
      expect(treatmentConflict(shift, fullAbsence, newWaiver, [cancelledCov], [], false)).toBeNull();
    });
  });

  describe("3. Destaque Visual dos Intervalos e Linha do Tempo", () => {
    it("calcula corretamente as frações para exibição na linha do tempo", () => {
      const morningCov: TreatmentRecord = {
        id: "cov-1",
        start_time: "08:00",
        end_time: "12:00",
        status: "realizada",
        coverer_type: "diarista",
        agreed_value: 130,
      };
      const partialWaiver: TreatmentRecord = {
        id: "waive-1",
        start_time: "13:00",
        end_time: "15:00",
        kind: "dispensa",
        active: true,
      };

      const result = computePostDay(shift, fullAbsence, [morningCov] as any, [partialWaiver] as any);

      // Jornada: 8h (480 min)
      expect(result.requiredMin).toBe(480);
      expect(result.coveredMin).toBe(240); // 4h coberto (50%)
      expect(result.waivedMin).toBe(120);  // 2h dispensado (25%)
      expect(result.pendingMin).toBe(120); // 2h pendente (25%)
      expect(result.uncoveredMin).toBe(120); // 2h a descontar caso não trate o restante
      expect(result.discountCents).toBe(4500); // 2h * R$ 22,50 = R$ 45,00
    });
  });

  describe("4. Diagnóstico de Registros Legados Conflitantes", () => {
    it("detecta duas coberturas legadas ativas sobrepostas no mesmo posto e data", () => {
      const legacy1: TreatmentRecord = {
        id: "leg-1",
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
        coverer_type: "diarista",
      };
      const legacy2: TreatmentRecord = {
        id: "leg-2",
        start_time: "13:00",
        end_time: "17:00",
        status: "realizada",
        coverer_type: "funcionario",
      };

      const duplicates = detectLegacyConflicts(shift, fullAbsence, [legacy1, legacy2], []);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].id1).toBe("leg-1");
      expect(duplicates[0].id2).toBe("leg-2");
      expect(duplicates[0].overlapMinutes).toBe(240); // 4h de sobreposição
    });

    it("ignora registros onde um deles já está cancelado ou inativo", () => {
      const legacy1: TreatmentRecord = {
        id: "leg-1",
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        status: "realizada",
      };
      const legacy2: TreatmentRecord = {
        id: "leg-2",
        start_time: "13:00",
        end_time: "17:00",
        status: "cancelada", // cancelado
      };

      const duplicates = detectLegacyConflicts(shift, fullAbsence, [legacy1, legacy2], []);
      expect(duplicates).toHaveLength(0);
    });
  });
});
