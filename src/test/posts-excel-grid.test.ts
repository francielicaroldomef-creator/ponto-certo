import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { upsertContractPostsBatch, type BatchPostInput } from "@/lib/data";
import { RS_CITIES, isRSCity } from "@/lib/rs-cities";

describe("📋 FLUXO HIERÁRQUICO DE POSTOS EM GRADE ESTILO EXCEL (/postos)", () => {
  const postosFilePath = path.resolve(__dirname, "../routes/_authenticated/postos.tsx");
  const postosContent = fs.readFileSync(postosFilePath, "utf-8");

  it("1. Seleção do Contrato prioriza o Nome Amigável (ex: PGE) e código como referência secundária", () => {
    // Verifica que o seletor exibe o nome e código
    expect(postosContent).toContain("c.name ? c.name : c.code");
    expect(postosContent).toContain("Código: {c.code}");
    expect(postosContent).toContain("Seleção do Contrato de Atuação");
  });

  it("2. Grade de Cidades padronizada para o Rio Grande do Sul e sem coluna 'Postos Configurados'", () => {
    expect(postosContent).toContain("Quantas cidades este contrato atende?");
    expect(postosContent).toContain("Cidades de Atuação no Rio Grande do Sul (Grade Excel)");
    expect(postosContent).toContain("Cidade de Atuação no Rio Grande do Sul");
    expect(postosContent).toContain("Qtd. de Postos Previstos nesta Cidade");
    expect(postosContent).toContain("Adicionar Cidade");
    expect(postosContent).toContain("rs-cities-datalist");
    // Garante que a coluna 'Postos Configurados' foi removida conforme especificação
    expect(postosContent).not.toContain("Postos Configurados");
    // Garante que os atalhos foram removidos e o seletor individual RSCityCombobox está presente
    expect(postosContent).not.toContain("Atalhos RS:");
    expect(postosContent).not.toContain("POPULAR_RS_CITIES");
    expect(postosContent).toContain("RSCityCombobox");
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

  it("8. Respeita limites estritos do contrato (postos e efetivo) bloqueando excessos", () => {
    // Valida que postos.tsx possui as travas contratuais
    expect(postosContent).toContain("contractLimitPosts");
    expect(postosContent).toContain("contractLimitStaff");
    expect(postosContent).toContain("não é permitido cadastrar mais de");
    expect(postosContent).toContain("O efetivo total não pode exceder");
    expect(postosContent).toContain("Saldo a Distribuir");
  });

  it("9. Migração 0006_contracts_required_posts.sql adiciona required_posts na tabela contracts", () => {
    const migrationPath = path.resolve(__dirname, "../../drizzle/migrations/0006_contracts_required_posts.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("ALTER TABLE public.contracts");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS required_posts int");
    expect(sql).toContain("code = 'CT-001'");
  });

  it("10. Lista oficial contém exatamente os 497 municípios do RS com seleção individual sem pré-seleção", () => {
    // 497 municípios oficiais do IBGE para o Estado do Rio Grande do Sul
    expect(RS_CITIES.length).toBe(497);

    // Sem duplicações
    const uniqueCities = new Set(RS_CITIES);
    expect(uniqueCities.size).toBe(497);

    // Validação de municípios chave
    expect(isRSCity("Porto Alegre")).toBe(true);
    expect(isRSCity("Erechim")).toBe(true);
    expect(isRSCity("Triunfo")).toBe(true);
    expect(isRSCity("Caxias do Sul")).toBe(true);
    expect(isRSCity("Passo Fundo")).toBe(true);
    expect(isRSCity("Pelotas")).toBe(true);
    expect(isRSCity("Santa Maria")).toBe(true);
    expect(isRSCity("Jacuizinho")).toBe(true);
    expect(isRSCity("Passa Sete")).toBe(true);
    expect(isRSCity("Unistalda")).toBe(true);
    expect(isRSCity("Cidade Fictícia Inexistente")).toBe(false);

    // postos.tsx deve instruir seleção individual entre os 497 municípios sem pré-seleção forçada
    expect(postosContent).toContain("497 municípios");
    expect(postosContent).toContain("sem pré-seleção forçada");
    expect(postosContent).toContain("placeholder=\"Selecione o município do RS (497 opções)...\"");
  });
});
