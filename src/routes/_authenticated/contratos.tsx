import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/crud-page";
import { DemoBadge, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Sistema Integrado Caroldo" }] }),
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

  // Consulta quantidade de postos vinculados a cada contrato
  const { data: postsStats } = useQuery({
    queryKey: ["contract-posts-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("id, contract_id, active");
      if (error) return {};
      const counts: Record<string, { total: number; active: number }> = {};
      (data ?? []).forEach((p) => {
        if (!counts[p.contract_id]) counts[p.contract_id] = { total: 0, active: 0 };
        counts[p.contract_id].total++;
        if (p.active) counts[p.contract_id].active++;
      });
      return counts;
    },
  });

  const supOpts = (profiles ?? []).map((p) => ({ value: p.id, label: p.full_name ?? p.email ?? p.id }));

  return (
    <div className="space-y-4">
      {/* Breadcrumb de navegação da Licitação */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/75">Licitação</span>
        <span>/</span>
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <FileSignature className="h-3.5 w-3.5 text-primary" />
          Contratos
        </span>
      </div>

      <CrudPage
        title="Contratos"
        table="contracts"
        order="code"
        search={(r) => `${r.code} ${r.name} ${r.client}`}
        description="Gestão de contratos e vinculação de postos de trabalho. Cada posto de trabalho pertence obrigatoriamente a um contrato."
        extraActions={
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link to="/postos">
              <MapPin className="h-4 w-4 text-primary" />
              Grade Geral de Postos
            </Link>
          </Button>
        }
        defaults={{ active: true, discount_rule: "hora", required_headcount: 30, required_posts: 30 }}
        transform={(v) => ({
          ...v,
          active: v["active"] === "true" || v["active"] === true,
          required_posts: Number(v["required_posts"] || v["required_headcount"] || 30),
          required_headcount: Number(v["required_headcount"] || 30),
        })}
        fields={[
          { key: "code", label: "Código", required: true, half: true },
          { key: "name", label: "Nome", required: true, half: true },
          { key: "client", label: "Cliente", required: true },
          { key: "start_date", label: "Início da vigência", type: "date", half: true },
          { key: "end_date", label: "Fim da vigência", type: "date", half: true },
          { key: "supervisor_id", label: "Supervisor responsável (usuário)", type: "select", options: supOpts },
          { key: "supervisor_name", label: "Nome do supervisor (exibição)" },
          { key: "required_posts", label: "Quantidade de postos contratados", type: "number", half: true },
          { key: "required_headcount", label: "Efetivo exigido (pessoas)", type: "number", half: true },
          {
            key: "discount_rule",
            label: "Regra de desconto",
            type: "select",
            half: true,
            options: [
              { value: "hora", label: "Por hora" },
              { value: "diaria", label: "Por diária" },
              { value: "turno", label: "Por turno" },
            ],
          },
          {
            key: "active",
            label: "Situação",
            type: "select",
            options: [
              { value: "true", label: "Ativo" },
              { value: "false", label: "Inativo" },
            ],
          },
        ]}
        cols={[
          { header: "Código", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
          {
            header: "Nome",
            cell: (r) => (
              <span className="flex items-center gap-2">
                {r.name}
                <DemoBadge show={r.is_demo} />
              </span>
            ),
          },
          { header: "Cliente", cell: (r) => r.client },
          { header: "Vigência", cell: (r) => `${fmtDate(r.start_date)} a ${fmtDate(r.end_date)}` },
          { header: "Supervisor", cell: (r) => r.supervisor_name ?? "—" },
          {
            header: "Postos Vinculados",
            cell: (r) => {
              const activePosts = postsStats?.[r.id]?.active ?? 0;
              const targetPosts = r.required_posts ?? r.required_headcount ?? 30;
              return (
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-foreground">{activePosts}</span>
                    <span className="text-muted-foreground">de</span>
                    <span className="font-semibold text-foreground">{targetPosts}</span>
                    <span className="text-[11px] text-muted-foreground">ativos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] gap-1 hover:border-primary hover:text-primary"
                      title={`Consultar e gerenciar os postos vinculados ao contrato ${r.code}`}
                    >
                      <Link to="/postos" search={{ contractId: r.id } as any}>
                        <MapPin className="h-3 w-3 text-primary" />
                        Ver Postos
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
                      title={`Cadastrar novo posto vinculado automaticamente ao contrato ${r.code}`}
                    >
                      <Link to="/postos" search={{ contractId: r.id, new: "true" } as any}>
                        <Plus className="h-3 w-3" />
                        Novo Posto
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            },
          },
          {
            header: "Efetivo",
            cell: (r) => <span className="font-semibold text-foreground">{r.required_headcount ?? 30}</span>,
          },
          { header: "Regra", cell: (r) => r.discount_rule },
          {
            header: "Situação",
            cell: (r) => (
              <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Inativo"}</Pill>
            ),
          },
        ]}
      />
    </div>
  );
}

