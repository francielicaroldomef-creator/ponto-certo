import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários e configurações — Portal do Supervisor" }] }),
  component: () => (
    <div>
      <PageHeader title="Usuários e configurações" description="Tela em implementação na próxima etapa. As regras no banco de dados já estão ativas." />
    </div>
  ),
});
