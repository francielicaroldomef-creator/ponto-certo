import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { DemoBadge, Pill } from "@/components/ui-kit";
import { useContracts } from "@/hooks/use-auth";
import { brlValue, hhmm } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/postos")({
  head: () => ({ meta: [{ title: "Postos — Portal do Supervisor" }] }),
  component: Postos,
});

function Postos() {
  const { data: contracts } = useContracts();
  return (
    <CrudPage title="Postos" table="posts" select="*, contract:contracts(code)" order="code"
      search={(r) => `${r.code} ${r.role_name} ${r.contract?.code}`}
      description="Valores alterados aqui não modificam registros já gravados (o valor da hora é congelado em cada registro)."
      defaults={{ start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00", required_qty: 1, active: "true", shift: "Diurno" }}
      transform={(v) => ({ ...v, active: v["active"] === "true" || v["active"] === true })}
      fields={[
        { key: "contract_id", label: "Contrato", type: "select", options: (contracts ?? []).map((c) => ({ value: c.id, label: c.code })) },
        { key: "code", label: "Código", half: true },
        { key: "role_name", label: "Função", half: true },
        { key: "shift", label: "Turno", half: true },
        { key: "required_qty", label: "Quantidade exigida", type: "number", half: true },
        { key: "start_time", label: "Entrada", type: "time", half: true },
        { key: "end_time", label: "Saída", type: "time", half: true },
        { key: "break_start", label: "Início do intervalo", type: "time", half: true },
        { key: "break_end", label: "Fim do intervalo", type: "time", half: true },
        { key: "day_value", label: "Valor por dia (R$)", type: "number", half: true },
        { key: "hour_value", label: "Valor por hora (R$)", type: "number", half: true },
        { key: "valid_from", label: "Vigência início", type: "date", half: true },
        { key: "valid_to", label: "Vigência fim", type: "date", half: true },
        { key: "active", label: "Situação", type: "select", options: [{ value: "true", label: "Ativo" }, { value: "false", label: "Inativo" }] },
      ]}
      cols={[
        { header: "Contrato", cell: (r) => r.contract?.code },
        { header: "Posto", cell: (r) => <span className="flex items-center gap-2 font-mono text-xs">{r.code}<DemoBadge show={r.is_demo} /></span> },
        { header: "Função", cell: (r) => r.role_name },
        { header: "Horário", cell: (r) => `${hhmm(r.start_time)}–${hhmm(r.end_time)} (int. ${hhmm(r.break_start)}–${hhmm(r.break_end)})` },
        { header: "Qtd.", cell: (r) => r.required_qty },
        { header: "Dia / Hora", cell: (r) => `${brlValue(r.day_value)} / ${brlValue(r.hour_value)}` },
        { header: "Situação", cell: (r) => <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Inativo"}</Pill> },
      ]} />
  );
}
