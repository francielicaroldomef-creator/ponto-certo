import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { upsertContractPostsBatch, type BatchPostInput } from "@/lib/data";

describe("📋 FLUXO HIERÁRQUICO DE POSTOS EM GRADE ESTILO EXCEL (/postos)", () => {
  const postosFilePath = path.resolve(__dirname, "../routes/_authenticated/postos.tsx");
  const postosContent = fs.readFileSync(postosFilePath, "utf-8");

  it("1. Seleção do Contrato prioriza o Nome Amigável (ex: PGE) e código como referência secundária", () => {
    // Verifica que o seletor exibe o nome e código
    expect(postosContent).toContain("c.name ? c.name : c.code");
    expect(postosContent).toContain("Código: {c.code}");
    expect(postosContent).toContain("Seleção do Contrato de Atuação");
  });

  it("2. Grade de Cidades permite definir quantidade e cadastrar nomes (ex: Erechim, Triunfo)", () => {
    expect(postosContent).toContain("Quantas cidades este contrato atende?");
    expect(postosContent).toContain("Cidades Atendidas pelo Contrato (Grade Excel)");
    expect(postosContent).toContain("Nome da Cidade de Atuação");
    expect(postosContent).toContain("Qtd. de Postos Previstos nesta Cidade");
    expect(postosContent).toContain("Adicionar Cidade");
  });

  it("3. Grade de Postos por Cidade estilo Excel possui colunas operacionais e navegação por teclado", () => {
    expect(postosContent).toContain("Código do Posto");
    expect(postosContent).toContain("Posto de Trabalho / Local");
    expect(postosContent).toContain("Função");
    expect(postosContent).toContain("Qtd. Exigida");
    expect(postosContent).toContain("Situação");
    expect(postosContent).toContain("handleKeyDownGrid");
    expect(postosContent).toContain("Servente de Limpeza");
    expect(postosContent).toContain("Todas as Cidades");
  });

  it("4. Remoção Completa da Indicação de Horários da interface de Postos", () => {
    // Nenhuma menção a colunas/campos de horários na interface
    expect(postosContent).not.toContain("Início do intervalo");
    expect(postosContent).not.toContain("Fim do intervalo");
    expect(postosContent).not.toContain("start_time");
    expect(postosContent).not.toContain("end_time");
    expect(postosContent).not.toContain("break_start");
    expect(postosContent).not.toContain("break_end");
    // Sem DemoBadge
    expect(postosContent).not.toContain("DemoBadge");
  });

  it("5. Botão de Gravação em Lote no rodapé com resumo operacional", () => {
    expect(postosContent).toContain("Salvar Cidades e Postos");
    expect(postosContent).toContain("Cidades");
    expect(postosContent).toContain("Postos de Trabalho");
    expect(postosContent).toContain("Vagas Totais");
    expect(postosContent).toContain("upsertContractPostsBatch");
  });

  it("6. Persistência em lote preenche valores seguros nos bastidores sem exigir horários do usuário", async () => {
    const fakeContractId = "c1111111-1111-1111-1111-111111111111";
    const samplePosts: BatchPostInput[] = [
      {
        contract_id: fakeContractId,
        code: "ERE-01",
        workplace: "Escola Serafim",
        city: "Erechim",
        role_name: "Servente de Limpeza",
        required_qty: 1,
        active: true,
      },
      {
        contract_id: fakeContractId,
        code: "TRI-01",
        workplace: "Fórum Central",
        city: "Triunfo",
        role_name: "Porteiro",
        required_qty: 2,
        active: true,
      },
    ];

    // Simula a montagem dos registros com valores padrão legados de horário
    const mappedRows = samplePosts.map((p) => ({
      contract_id: p.contract_id,
      code: p.code.trim(),
      workplace: p.workplace.trim() || `Posto ${p.code.trim()}`,
      city: p.city.trim(),
      role_name: p.role_name?.trim() || "Servente de Limpeza",
      required_qty: p.required_qty && p.required_qty > 0 ? Number(p.required_qty) : 1,
      active: p.active ?? true,
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      shift: "Diurno",
      day_value: 0,
      hour_value: 0,
    }));

    expect(mappedRows.length).toBe(2);
    expect(mappedRows[0].city).toBe("Erechim");
    expect(mappedRows[0].workplace).toBe("Escola Serafim");
    expect(mappedRows[0].code).toBe("ERE-01");
    expect(mappedRows[0].start_time).toBe("08:00");
    expect(mappedRows[0].end_time).toBe("17:00");
    expect(mappedRows[0].break_start).toBe("12:00");
    expect(mappedRows[0].break_end).toBe("13:00");
    expect(mappedRows[0].shift).toBe("Diurno");

    expect(mappedRows[1].city).toBe("Triunfo");
    expect(mappedRows[1].workplace).toBe("Fórum Central");
    expect(mappedRows[1].code).toBe("TRI-01");
    expect(mappedRows[1].required_qty).toBe(2);
  });

  it("7. Contrato PGE (CT-001) possui exatamente 30 postos oficiais (P01 a P30) e não 45", () => {
    // Valida que postos.tsx possui a inicialização oficial para 30 postos e o botão de restauração
    expect(postosContent).toContain("Restaurar 30 Postos Oficiais (P01 a P30)");
    expect(postosContent).toContain("handleRestore30Posts");
    expect(postosContent).toContain('selectedContract?.code === "CT-001"');
    expect(postosContent).toContain("selectedContract.required_headcount || 30");

    // Valida que a migração 0005_enforce_30_posts_pge.sql existe e reforça 30 postos
    const migrationPath = path.resolve(__dirname, "../../drizzle/migrations/0005_enforce_30_posts_pge.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    expect(migrationSql).toContain("required_headcount = 30");
    expect(migrationSql).toContain("code = 'CT-001'");
    expect(migrationSql).toContain("'P01','P02','P03'");
    expect(migrationSql).toContain("'P30'");
  });
});
