import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/fechamentos")({
  head: () => ({ meta: [{ title: "Fechamentos — Portal do Supervisor" }] }),
  component: () => (
    <div>
      <PageHeader title="Fechamentos" description="Tela em implementação na próxima etapa. As regras no banco de dados já estão ativas." />
    </div>
  ),
});
