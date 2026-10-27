import { describe, expect, it, beforeEach } from "vitest";
import {
  authenticateQuickAccess,
  saveQuickCredential,
  deleteQuickCredential,
  getQuickCredentials,
  getQuickAccessSession,
  setQuickAccessSession,
  clearQuickAccessSession,
  MASTER_PASSWORD,
  AVAILABLE_MODULES,
} from "@/lib/quick-access";

describe("🔐 ACESSO SECRETO POR CLIQUE TRIPLO E GESTÃO DE ACESSOS INDIVIDUAIS", () => {
  beforeEach(() => {
    clearQuickAccessSession();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("1. Acesso Master com senha 'francieliadmin': concede perfil Super Administrador e todos os módulos", async () => {
    const authResult = await authenticateQuickAccess(MASTER_PASSWORD);

    expect(authResult.success).toBe(true);
    expect(authResult.session).toBeDefined();

    const session = authResult.session!;
    expect(session.isMasterAdmin).toBe(true);
    expect(session.role).toBe("admin");
    expect(session.name).toContain("Francieli");
    // Todos os módulos liberados
    expect(session.allowedModules.length).toBe(AVAILABLE_MODULES.length);
    expect(session.allowedModules).toContain("/usuarios");
    expect(session.allowedModules).toContain("/fechamentos");
    expect(session.allowedModules).toContain("/conferencia");

    // Verifica que a sessão foi persistida no storage
    const stored = getQuickAccessSession();
    expect(stored).not.toBeNull();
    expect(stored?.isMasterAdmin).toBe(true);
  });

  it("2. Criação de acesso individual pela Francieli para colaborador (Carlos - Supervisor)", async () => {
    const cred = await saveQuickCredential({
      name: "Carlos - Supervisor",
      access_key: "carlos123",
      role: "supervisor",
      allowed_contracts: ["ct-001"],
      allowed_modules: ["/conferencia", "/efetivo"],
      active: true,
    });

    expect(cred.id).toBeDefined();
    expect(cred.name).toBe("Carlos - Supervisor");
    expect(cred.access_key).toBe("carlos123");
    expect(cred.role).toBe("supervisor");

    const all = await getQuickCredentials();
    const found = all.find((c) => c.access_key === "carlos123");
    expect(found).toBeDefined();
    expect(found?.allowed_contracts).toEqual(["ct-001"]);
    expect(found?.allowed_modules).toEqual(["/conferencia", "/efetivo"]);
  });

  it("3. Autenticação do colaborador pelo clique triplo com sua senha individual ('carlos123')", async () => {
    // Cadastra Carlos
    await saveQuickCredential({
      name: "Carlos - Supervisor",
      access_key: "carlos123",
      role: "supervisor",
      allowed_contracts: ["ct-001"],
      allowed_modules: ["/conferencia", "/efetivo"],
      active: true,
    });

    // Carlos digita sua senha
    const authResult = await authenticateQuickAccess("carlos123");

    expect(authResult.success).toBe(true);
    const session = authResult.session!;
    expect(session.name).toBe("Carlos - Supervisor");
    expect(session.role).toBe("supervisor");
    expect(session.isMasterAdmin).toBe(false);

    // Contratos e módulos estritamente isolados
    expect(session.allowedContracts).toEqual(["ct-001"]);
    expect(session.allowedModules).toEqual(["/conferencia", "/efetivo"]);
    expect(session.allowedModules).not.toContain("/usuarios");
    expect(session.allowedModules).not.toContain("/fechamentos");
  });

  it("4. Rejeição de senha inválida no clique triplo", async () => {
    const authResult = await authenticateQuickAccess("senha_errada_xyz");
    expect(authResult.success).toBe(false);
    expect(authResult.session).toBeUndefined();
    expect(authResult.error).toContain("Senha incorreta");

    // Nenhuma sessão criada
    expect(getQuickAccessSession()).toBeNull();
  });

  it("5. Bloqueio de acesso para credencial inativada", async () => {
    const cred = await saveQuickCredential({
      name: "João Inativo",
      access_key: "joao123",
      role: "supervisor",
      allowed_contracts: [],
      allowed_modules: ["/painel"],
      active: false, // Inativo
    });

    const authResult = await authenticateQuickAccess("joao123");
    expect(authResult.success).toBe(false);
    expect(authResult.error).toContain("Senha incorreta ou acesso inativo");
  });

  it("6. Logout e encerramento de sessão rápida (isolamento garantido)", async () => {
    // Autentica master
    await authenticateQuickAccess(MASTER_PASSWORD);
    expect(getQuickAccessSession()).not.toBeNull();

    // Encerra sessão
    clearQuickAccessSession();
    expect(getQuickAccessSession()).toBeNull();
  });

  it("7. Lógica temporal do clique triplo (janela de 1200ms)", () => {
    // Teste de lógica de detecção de 3 cliques dentro do tempo limite
    const createTripleClickDetector = (onTrigger: () => void, maxIntervalMs = 1200) => {
      let clickCount = 0;
      let firstClickTime = 0;

      return (currentTime: number) => {
        if (clickCount === 0 || currentTime - firstClickTime > maxIntervalMs) {
          clickCount = 1;
          firstClickTime = currentTime;
          return;
        }

        clickCount += 1;
        if (clickCount >= 3) {
          clickCount = 0;
          firstClickTime = 0;
          onTrigger();
        }
      };
    };

    let triggeredCount = 0;
    const detector = createTripleClickDetector(() => {
      triggeredCount += 1;
    }, 1200);

    // Cenário A: 3 cliques rápidos (0ms, 300ms, 600ms) -> Dispara
    detector(1000);
    detector(1300);
    detector(1600);
    expect(triggeredCount).toBe(1);

    // Cenário B: Cliques lentos (espaçados por 1500ms) -> NÃO dispara
    detector(3000);
    detector(4600); // Já passou 1600ms (> 1200ms) -> reinicia contagem para 1
    detector(5000); // 2 cliques
    expect(triggeredCount).toBe(1); // Não disparou o 2º

    // Cenário C: Terceiro clique rápido após o reinício -> Dispara
    detector(5300); // 3º clique rápido dentro de 700ms de 4600ms
    expect(triggeredCount).toBe(2);
  });
});
