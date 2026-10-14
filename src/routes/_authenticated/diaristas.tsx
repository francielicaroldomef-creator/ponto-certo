import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { DemoBadge, Pill } from "@/components/ui-kit";
import { brlValue } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/diaristas")({
  head: () => ({ meta: [{ title: "Diaristas — Portal do Supervisor" }] }),
  component: () => (
    <CrudPage title="Diaristas" table="day_workers" order="code" search={(r) => `${r.code} ${r.name}`}
      description="Valores padrão; cada cobertura pode ter um valor específico combinado."
      defaults={{ status: "ativo" }}
      fields={[
        { key: "code", label: "Código", half: true },
        { key: "name", label: "Nome", half: true },
        { key: "phone", label: "Telefone (opcional)", half: true },
        { key: "status", label: "Situação", type: "select", half: true, options: [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }] },
        { key: "availability", label: "Disponibilidade" },
        { key: "day_rate", label: "Valor por diária (R$)", type: "number", half: true },
        { key: "hour_rate", label: "Valor por hora (R$)", type: "number", half: true },
      ]}
      cols={[
        { header: "Código", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
        { header: "Nome", cell: (r) => <span className="flex items-center gap-2">{r.name}<DemoBadge show={r.is_demo} /></span> },
        { header: "Telefone", cell: (r) => r.phone ?? "—" },
        { header: "Disponibilidade", cell: (r) => r.availability ?? "—" },
        { header: "Diária", cell: (r) => brlValue(r.day_rate) },
        { header: "Hora", cell: (r) => brlValue(r.hour_rate) },
        { header: "Situação", cell: (r) => <Pill tone={r.status === "ativo" ? "success" : "neutral"}>{r.status === "ativo" ? "Ativo" : "Inativo"}</Pill> },
      ]} />
  ),
});
