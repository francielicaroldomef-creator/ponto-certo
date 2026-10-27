import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";

// Mock router hooks
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, onClick, className }: any) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => "/conferencia",
}));

// Mock useMe hook
vi.mock("@/hooks/use-auth", () => ({
  useMe: () => ({
    data: {
      user: { id: "user-1", email: "supervisor@teste.com" },
      profile: { full_name: "Supervisor Teste" },
      roles: ["supervisor"],
      has: (...want: string[]) => want.includes("supervisor"),
    },
    isLoading: false,
  }),
}));

describe("Item 6: Navegação e Responsividade Mobile", () => {
  it("6.1 Renderiza menu mobile (header com botão gaveta) e aside desktop", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AppShell>
          <div data-testid="page-content">Conteúdo da Conferência Diária</div>
        </AppShell>
      </QueryClientProvider>
    );

    // Conteúdo da página é visível
    expect(screen.getByTestId("page-content")).toBeInTheDocument();

    // Botão de menu hambúrguer para mobile
    const menuBtn = screen.getByRole("button", { name: /abrir menu/i });
    expect(menuBtn).toBeInTheDocument();

    // Clica no botão hambúrguer para abrir a gaveta mobile (Sheet)
    fireEvent.click(menuBtn);

    // O menu gaveta deve conter a navegação com os links permitidos do Supervisor
    const navLinks = screen.getAllByRole("link", { name: /conferência diária/i });
    expect(navLinks.length).toBeGreaterThan(0);
  });

  it("6.2 Viewport mobile (360px a 400px): valida classes utilitárias de adaptação", () => {
    // Validação estática de classes responsivas no layout:
    // Header mobile possui 'lg:hidden'
    // Aside desktop possui 'hidden lg:flex'
    // Sheet mobile possui 'w-72'
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <AppShell>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button>Presente</button>
            <button>Falta</button>
            <button>Cobertura</button>
          </div>
        </AppShell>
      </QueryClientProvider>
    );

    const mobileHeader = container.querySelector("header.lg\\:hidden");
    expect(mobileHeader).not.toBeNull();

    const desktopAside = container.querySelector("aside.hidden.lg\\:flex");
    expect(desktopAside).not.toBeNull();
  });
});
