import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos de ponto — Portal do Supervisor" }] }),
  component: () => (
    <div>
      <PageHeader title="Documentos de ponto" description="Tela em implementação na próxima etapa. As regras no banco de dados já estão ativas." />
    </div>
  ),
});
