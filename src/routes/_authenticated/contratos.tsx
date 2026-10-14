import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/crud-page";
import { DemoBadge, Pill } from "@/components/ui-kit";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Portal do Supervisor" }] }),
  component: Contratos,
});

function Contratos() {
  const { data: profiles } = useQuery({
    queryKey: ["supervisors"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "supervisor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? [];
    },
  });
  const supOpts = (profiles ?? []).map((p) => ({ value: p.id, label: p.full_name ?? p.email ?? p.id }));
  return (
    <CrudPage title="Contratos" table="contracts" order="code" search={(r) => `${r.code} ${r.name} ${r.client}`}
      description="Supervisores só visualizam contratos em que são responsáveis."
      defaults={{ active: true, discount_rule: "hora", required_headcount: 0 }}
      transform={(v) => ({ ...v, active: v.active === "true" || v.active === true })}
      fields={[
        { key: "code", label: "Código", required: true, half: true },
        { key: "name", label: "Nome", required: true, half: true },
        { key: "client", label: "Cliente", required: true },
        { key: "start_date", label: "Início da vigência", type: "date", half: true },
        { key: "end_date", label: "Fim da vigência", type: "date", half: true },
        { key: "supervisor_id", label: "Supervisor responsável (usuário)", type: "select", options: supOpts },
        { key: "supervisor_name", label: "Nome do supervisor (exibição)" },
        { key: "required_headcount", label: "Efetivo exigido", type: "number", half: true },
        { key: "discount_rule", label: "Regra de desconto", type: "select", half: true, options: [{ value: "hora", label: "Por hora" }, { value: "diaria", label: "Por diária" }, { value: "turno", label: "Por turno" }] },
        { key: "active", label: "Situação", type: "select", options: [{ value: "true", label: "Ativo" }, { value: "false", label: "Inativo" }] },
      ]}
      cols={[
        { header: "Código", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
        { header: "Nome", cell: (r) => <span className="flex items-center gap-2">{r.name}<DemoBadge show={r.is_demo} /></span> },
        { header: "Cliente", cell: (r) => r.client },
        { header: "Vigência", cell: (r) => `${fmtDate(r.start_date)} a ${fmtDate(r.end_date)}` },
        { header: "Supervisor", cell: (r) => r.supervisor_name ?? "—" },
        { header: "Efetivo", cell: (r) => r.required_headcount },
        { header: "Regra", cell: (r) => r.discount_rule },
        { header: "Situação", cell: (r) => <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Inativo"}</Pill> },
      ]} />
  );
}
