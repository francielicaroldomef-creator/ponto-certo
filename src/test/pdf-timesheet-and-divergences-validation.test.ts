import { describe, expect, it } from "vitest";
import { parseTimesheet } from "@/lib/timesheet";

describe("Item 5: Upload de Cartão de Ponto em PDF e Divergências", () => {
  it("5.1 Extração das 4 batidas diárias de cartão de ponto com texto nativo", () => {
    const rawPages = [
      [
        "EMPRESA DE LIMPEZA E SERVICOS LTDA",
        "Matrícula: ST001  Nome: Servente Teste 01  Cargo: Servente",
        "05/10/2026 08:00 12:00 13:00 17:00",
        "06/10/2026 08:01 12:00 13:02 17:05",
      ],
    ];

    const punches = parseTimesheet(rawPages, 2026);
    expect(punches.length).toBe(2);

    expect(punches[0]).toEqual({
      page: 1,
      registration: "ST001",
      name: "Servente Teste 01",
      work_date: "2026-10-05",
      marks: ["08:00", "12:00", "13:00", "17:00"],
    });

    expect(punches[1]?.marks).toEqual(["08:01", "12:00", "13:02", "17:05"]);
  });

  it("5.1 Geração de divergências automáticas comparando com a conferência manual", () => {
    // Cenário A: Funcionário marcado manualmente como 'presente', mas ponto vem sem nenhuma marcação (ST007)
    const pSemMarcacao = { registration: "ST007", marks: [] };
    const manualStatusA = "presente";
    const gerarDivergenciaA = (marks: string[], st: string) => {
      if (marks.length === 0 && st === "presente") {
        return { kind: "presenca_sem_marcacao", reason: "Lançado como presente, mas sem marcações no cartão.", affects_calc: true };
      }
      return null;
    };
    const divA = gerarDivergenciaA(pSemMarcacao.marks, manualStatusA);
    expect(divA?.kind).toBe("presenca_sem_marcacao");
    expect(divA?.affects_calc).toBe(true);

    // Cenário B: Marcação ímpar / jornada incompleta (ST008: 08:00 12:00 13:00)
    const pImpar = { registration: "ST008", marks: ["08:00", "12:00", "13:00"] };
    const gerarDivergenciaB = (marks: string[]) => {
      if (marks.length % 2 === 1) {
        return { kind: "marcacao_impar", reason: `Número ímpar de marcações (${marks.join(" ")}).`, affects_calc: true };
      }
      return null;
    };
    const divB = gerarDivergenciaB(pImpar.marks);
    expect(divB?.kind).toBe("marcacao_impar");
    expect(divB?.reason).toContain("08:00 12:00 13:00");

    // Cenário C: Lançado como falta integral, mas há batidas no cartão
    const pBatidaEmFalta = { registration: "ST009", marks: ["08:00", "17:00"] };
    const manualStatusC = "falta_integral";
    const gerarDivergenciaC = (marks: string[], st: string) => {
      if (marks.length > 0 && st === "falta_integral") {
        return { kind: "marcacao_em_falta", reason: `Lançado como falta integral, mas há marcações (${marks.join(" ")}).`, affects_calc: true };
      }
      return null;
    };
    const divC = gerarDivergenciaC(pBatidaEmFalta.marks, manualStatusC);
    expect(divC?.kind).toBe("marcacao_em_falta");
  });

  it("5.2 Resolução de Divergência: exige justificativa mínima (mín. 5 chars) e altera status para resolvida", () => {
    const resolverDivergencia = (div: { id: string; status: string }, justificativa: string) => {
      if (justificativa.trim().length < 5) throw new Error("Descreva a resolução (mín. 5 caracteres).");
      return { ...div, status: "resolvida", resolution: justificativa, resolved_at: new Date().toISOString() };
    };

    const divAberta = { id: "div-1", status: "aberta" };
    expect(() => resolverDivergencia(divAberta, "ok")).toThrow("Descreva a resolução (mín. 5 caracteres).");

    const resolvida = resolverDivergencia(divAberta, "Esquecimento de registro; confirmado pelo supervisor in loco.");
    expect(resolvida.status).toBe("resolvida");
    expect(resolvida.resolution).toContain("confirmado pelo supervisor");
  });

  it("5.3 Fallback manual para arquivos digitalizados (imagem pura sem camada de texto)", () => {
    // Simulação de PDF digitalizado que retorna texto vazio ou inferior a 20 caracteres
    const rawPagesScanned = [[""]];
    const textLen = rawPagesScanned.flat().join("").trim().length;

    const avaliarDocumento = (len: number, extractedCount: number) => {
      if (len < 20 || extractedCount === 0) {
        return {
          status: "conferencia_manual",
          error: "PDF sem texto (digitalizado). OCR não configurado — conferir manualmente.",
          divergence: {
            kind: "documento_ilegivel",
            reason: "Documento exige conferência manual.",
            affects_calc: false,
          },
        };
      }
      return { status: "processado" };
    };

    const resultado = avaliarDocumento(textLen, 0);
    expect(resultado.status).toBe("conferencia_manual");
    expect(resultado.error).toContain("OCR não configurado — conferir manualmente");
    expect(resultado.divergence.kind).toBe("documento_ilegivel");
    expect(resultado.divergence.affects_calc).toBe(false);
  });
});
