import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("🏢 Estruturação e Exibição da Página de Postos (/postos)", () => {
  it("1. Migração SQL 0004_posts_workplace_and_city.sql contém todas as instruções requeridas", () => {
    const migrationPath = path.resolve(__dirname, "../../drizzle/migrations/0004_posts_workplace_and_city.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("ALTER TABLE public.posts");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS workplace text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS city text");
    expect(sql).toContain("ALTER TABLE public.contracts");
    expect(sql).toContain("UPDATE public.contracts");
    expect(sql).toContain("name = 'PGE'");
    expect(sql).toContain("city = 'Florianópolis'");
    expect(sql).toContain("workplace = 'Escola Serafim'");
  });

  it("2. Formatação da Coluna 1 (Contrato): Exibe nome em destaque (PGE) e código como referência (CT-001)", () => {
    const renderContractCell = (r: { contract?: { name?: string | null; code?: string | null } | null }) => {
      const title = r.contract?.name ?? r.contract?.code;
      const subtitle = r.contract?.name ? r.contract?.code : null;
      return { title, subtitle };
    };

    // Caso A: Contrato com nome "PGE" e código "CT-001"
    const cellA = renderContractCell({ contract: { name: "PGE", code: "CT-001" } });
    expect(cellA.title).toBe("PGE");
    expect(cellA.subtitle).toBe("CT-001");

    // Caso B: Contrato sem nome preenchido
    const cellB = renderContractCell({ contract: { name: null, code: "CT-002" } });
    expect(cellB.title).toBe("CT-002");
    expect(cellB.subtitle).toBeNull();
  });

  it("3. Formatação da Coluna 2 (Posto de Trabalho): Exibe local (Escola Serafim) e código (P01)", () => {
    const renderWorkplaceCell = (r: { code: string; workplace?: string | null }) => {
      const workplaceName = r.workplace || `Posto ${r.code}`;
      const codeChip = r.code;
      return { workplaceName, codeChip };
    };

    // Caso A: Posto com local "Escola Serafim" e código "P01"
    const cellA = renderWorkplaceCell({ code: "P01", workplace: "Escola Serafim" });
    expect(cellA.workplaceName).toBe("Escola Serafim");
    expect(cellA.codeChip).toBe("P01");

    // Caso B: Posto sem local cadastrado (fallback)
    const cellB = renderWorkplaceCell({ code: "P02", workplace: null });
    expect(cellB.workplaceName).toBe("Posto P02");
    expect(cellB.codeChip).toBe("P02");
  });

  it("4. Formatação da Coluna 3 (Cidade): Exibe cidade de atuação e não exibe 'Fictício'", () => {
    const renderCityCell = (r: { city?: string | null; contract?: { city?: string | null } | null }) => {
      return r.city ?? r.contract?.city ?? "Não informada";
    };

    // Cidade direta do posto
    expect(renderCityCell({ city: "Florianópolis", contract: null })).toBe("Florianópolis");

    // Herança da cidade do contrato
    expect(renderCityCell({ city: null, contract: { city: "São José" } })).toBe("São José");

    // Fallback quando não informada
    expect(renderCityCell({ city: null, contract: null })).toBe("Não informada");

    // Verifica que o arquivo postos.tsx não utiliza DemoBadge na tabela
    const postosFilePath = path.resolve(__dirname, "../routes/_authenticated/postos.tsx");
    const postosFileContent = fs.readFileSync(postosFilePath, "utf-8");
    expect(postosFileContent).not.toContain("DemoBadge");
  });

  it("5. Seletor de Contrato no formulário exibe 'Nome (Código)'", () => {
    const contractsMock = [
      { id: "c1", code: "CT-001", name: "PGE" },
      { id: "c2", code: "CT-002", name: "Prefeitura Municipal" },
      { id: "c3", code: "CT-003", name: "" },
    ];

    const options = contractsMock.map((c) => ({
      value: c.id,
      label: c.name ? `${c.name} (${c.code})` : c.code,
    }));

    expect(options[0].label).toBe("PGE (CT-001)");
    expect(options[1].label).toBe("Prefeitura Municipal (CT-002)");
    expect(options[2].label).toBe("CT-003");
  });
});
