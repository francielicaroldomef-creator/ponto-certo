import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/divergencias")({
  head: () => ({ meta: [{ title: "Divergências — Portal do Supervisor" }] }),
  component: () => (
    <div>
      <PageHeader title="Divergências" description="Tela em implementação na próxima etapa. As regras no banco de dados já estão ativas." />
    </div>
  ),
});
