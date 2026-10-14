import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/efetivo")({
  head: () => ({ meta: [{ title: "Conferência do efetivo — Portal do Supervisor" }] }),
  component: () => (
    <div>
      <PageHeader title="Conferência do efetivo" description="Tela em implementação na próxima etapa. As regras no banco de dados já estão ativas." />
    </div>
  ),
});
