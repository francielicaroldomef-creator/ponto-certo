import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fetchAll } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ContractSelect, DataTable, DemoBadge, Field, PageHeader, Pill, Stat, useDefaultContract } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/divergencias")({
  head: () => ({ meta: [{ title: "Divergências — Portal do Supervisor" }, { name: "description", content: "Fila de divergências entre ponto, escala e presença." }] }),
  component: Divergencias,
});

export const KIND_LABEL: Record<string, string> = {
  funcionario_nao_identificado: "Funcionário não identificado",
  identificacao_incerta: "Identificação incerta",
  marcacao_impar: "Marcação ímpar",
  presenca_sem_marcacao: "Presença sem marcação",
  marcacao_em_falta: "Marcação em dia de falta",
  marcacao_fora_escala: "Marcação fora da escala",
  documento_ilegivel: "Documento ilegível",
};

function Divergencias() {
  const [contract, setContract] = useDefaultContract();
  const [status, setStatus] = useState("aberta");
  const [sel, setSel] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [exclude, setExclude] = useState(false);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canReview = me?.has("admin", "conferente");

  const { data } = useQuery({
    queryKey: ["divergences", contract],
    enabled: !!contract,
    queryFn: () => fetchAll((a, b) => supabase.from("divergences").select("*, employee:employees(registration, name), doc:timesheet_docs(file_name)").eq("contract_id", contract).order("work_date", { ascending: false }).range(a, b)),
  });
  const all = data ?? [];
  const rows = status === "todas" ? all : all.filter((d: any) => d.status === status);
  const open = all.filter((d: any) => d.status === "aberta");

  const resolve = async () => {
    if (resolution.trim().length < 5) { toast.error("Descreva a resolução (mín. 5 caracteres)."); return; }
    const { error } = await supabase.from("divergences").update({ status: "resolvida", resolution, excluded_from_totals: exclude, resolved_by: me?.user.id ?? null, resolved_at: new Date().toISOString() }).eq("id", sel.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Divergência resolvida.");
    setSel(null);
    qc.invalidateQueries({ queryKey: ["divergences"] });
    qc.invalidateQueries({ queryKey: ["period"] });
  };
  const reopen = async (d: any) => {
    const { error } = await supabase.from("divergences").update({ status: "aberta", resolved_at: null, resolved_by: null }).eq("id", d.id);
    if (error) toast.error(errMsg(error)); else qc.invalidateQueries({ queryKey: ["divergences"] });
  };

  return (
    <div>
      <PageHeader title="Divergências" description="Enquanto houver divergência aberta que afeta o cálculo, os valores do período ficam provisórios." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Abertas" value={open.length} tone={open.length ? "warning" : "success"} />
        <Stat label="Afetam o cálculo" value={open.filter((d: any) => d.affects_calc).length} tone="danger" />
        <Stat label="Resolvidas" value={all.length - open.length} tone="success" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable rows={rows} rowKey={(d: any) => d.id} search={(d: any) => `${d.employee?.name ?? ""} ${d.reason} ${d.kind}`}
        cols={[
          { header: "Data", cell: (d: any) => fmtDate(d.work_date) },
          { header: "Funcionário", cell: (d: any) => d.employee ? `${d.employee.registration} — ${d.employee.name}` : "—" },
          { header: "Tipo", cell: (d: any) => <span className="flex items-center gap-1">{KIND_LABEL[d.kind] ?? d.kind}<DemoBadge show={d.is_demo} /></span> },
          { header: "Motivo", cell: (d: any) => <span className="text-sm">{d.reason}</span> },
          { header: "Origem", cell: (d: any) => d.doc ? <span className="text-xs text-muted-foreground">{d.doc.file_name}{d.page ? ` · p.${d.page}` : ""}</span> : "Manual" },
          { header: "Cálculo", cell: (d: any) => d.affects_calc ? <Pill tone={d.excluded_from_totals ? "neutral" : "danger"}>{d.excluded_from_totals ? "Excluída" : "Afeta"}</Pill> : <Pill>Não afeta</Pill> },
          { header: "Situação", cell: (d: any) => d.status === "aberta" ? <Pill tone="warning">Aberta</Pill> : <span title={d.resolution ?? ""}><Pill tone="success">Resolvida {fmtDateTime(d.resolved_at)}</Pill></span> },
          { header: "", cell: (d: any) => canReview ? (d.status === "aberta"
            ? <Button size="sm" onClick={() => { setSel(d); setResolution(""); setExclude(false); }}>Resolver</Button>
            : <Button size="sm" variant="ghost" onClick={() => reopen(d)}>Reabrir</Button>) : null },
        ]} />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolver divergência</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{sel?.reason}</p>
          <Field label="Resolução (ficará na auditoria)">
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Ex.: Presença confirmada pelo cliente; lançamento corrigido na conferência." />
          </Field>
          {sel?.affects_calc && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={exclude} onCheckedChange={(v) => setExclude(!!v)} />Excluir dos totais (não gera desconto)</label>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button><Button onClick={resolve}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
