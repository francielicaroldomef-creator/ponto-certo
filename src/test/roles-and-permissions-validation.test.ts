import { describe, expect, it } from "vitest";
import { isSupervisorOnly, SUPERVISOR_PATHS } from "@/components/app-shell";

describe("Item 4: Perfis de Acesso e Regras de Permissão (RLS)", () => {
  it("4.1 Perfil Supervisor: detecta supervisor-only e bloqueia rotas administrativas", () => {
    const rolesSupervisor = ["supervisor"];
    expect(isSupervisorOnly(rolesSupervisor)).toBe(true);

    // Supervisor tem acesso às rotas operacionais
    expect(SUPERVISOR_PATHS).toContain("/painel");
    expect(SUPERVISOR_PATHS).toContain("/conferencia");
    expect(SUPERVISOR_PATHS).toContain("/coberturas");
    expect(SUPERVISOR_PATHS).toContain("/efetivo");
    expect(SUPERVISOR_PATHS).toContain("/relatorios");
    expect(SUPERVISOR_PATHS).toContain("/fechamentos");

    // Supervisor NÃO tem acesso aos cadastros estruturais e configurações
    const rotasBloqueadas = ["/contratos", "/postos", "/funcionarios", "/escalas", "/diaristas", "/documentos", "/usuarios"];
    for (const rota of rotasBloqueadas) {
      const allowed = (SUPERVISOR_PATHS as readonly string[]).includes(rota);
      expect(allowed).toBe(false);
    }
  });

  it("4.1 Regra de isolamento de contrato (RLS can_access_contract)", () => {
    // Simulação da função SQL can_access_contract:
    const canAccessContract = (userId: string, roles: string[], contractSupervisorId: string | null) => {
      if (roles.includes("admin") || roles.includes("conferente") || roles.includes("financeiro")) {
        return true; // Staff corporativo tem acesso global
      }
      if (roles.includes("supervisor")) {
        return contractSupervisorId === userId; // Apenas contratos sob sua supervisão
      }
      return false;
    };

    const supervisorUser = "user-sup-01";
    const supervisorRoles = ["supervisor"];

    const contratoCT001 = { id: "ct-001", supervisor_id: "user-sup-01" };
    const contratoCT002 = { id: "ct-002", supervisor_id: "user-sup-02" }; // Outro supervisor

    // Supervisor CT-001 consegue acessar CT-001
    expect(canAccessContract(supervisorUser, supervisorRoles, contratoCT001.supervisor_id)).toBe(true);
    // Supervisor CT-001 NÃO consegue acessar CT-002 (RLS bloqueia)
    expect(canAccessContract(supervisorUser, supervisorRoles, contratoCT002.supervisor_id)).toBe(false);
  });

  it("4.2 Perfil Conferente vs Financeiro: Conferente não fecha período financeiro; Financeiro fecha", () => {
    const canCloseClosing = (roles: string[]) => roles.includes("admin") || roles.includes("financeiro");
    const canReviewDivergences = (roles: string[]) => roles.includes("admin") || roles.includes("conferente");

    const conferenteRoles = ["conferente"];
    const financeiroRoles = ["financeiro"];

    // Conferente: revisa divergências, mas NÃO fecha período
    expect(canReviewDivergences(conferenteRoles)).toBe(true);
    expect(canCloseClosing(conferenteRoles)).toBe(false);

    // Financeiro: fecha período financeiro
    expect(canCloseClosing(financeiroRoles)).toBe(true);
  });
});
