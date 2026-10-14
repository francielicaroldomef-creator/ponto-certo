import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/crud-page";
import { DemoBadge, Field, Pill } from "@/components/ui-kit";
import { useContracts, useMe } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import { errMsg } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Portal do Supervisor" }] }),
  component: Funcionarios,
});

function Funcionarios() {
  const [hist, setHist] = useState<any>(null);
  return (
    <>
      <CrudPage title="Funcionários" table="employees" order="registration"
        select="*, assignments:employee_assignments(id, start_date, end_date, contract:contracts(code), post:posts(code))"
        search={(r) => `${r.registration} ${r.name}`} defaults={{ status: "ativo" }}
        description="Matrícula é o identificador principal, inclusive na leitura dos pontos."
        fields={[
          { key: "registration", label: "Matrícula", half: true },
          { key: "name", label: "Nome", half: true },
          { key: "role_name", label: "Função", half: true },
          { key: "admission_date", label: "Admissão", type: "date", half: true },
          { key: "status", label: "Situação", type: "select", options: [{ value: "ativo", label: "Ativo" }, { value: "afastado", label: "Afastado" }, { value: "inativo", label: "Inativo" }] },
        ]}
        cols={[
          { header: "Matrícula", cell: (r) => <span className="font-mono text-xs">{r.registration}</span> },
          { header: "Nome", cell: (r) => <span className="flex items-center gap-2">{r.name}<DemoBadge show={r.is_demo} /></span> },
          { header: "Função", cell: (r) => r.role_name },
          { header: "Admissão", cell: (r) => fmtDate(r.admission_date) },
          { header: "Vínculo atual", cell: (r) => { const a = (r.assignments ?? []).find((x: any) => !x.end_date); return a ? `${a.contract?.code} / ${a.post?.code ?? "—"}` : "—"; } },
          { header: "Situação", cell: (r) => <Pill tone={r.status === "ativo" ? "success" : r.status === "afastado" ? "info" : "neutral"}>{r.status}</Pill> },
          { header: "Vínculos", cell: (r) => <Button size="sm" variant="ghost" onClick={() => setHist(r)}><History className="h-4 w-4" /></Button> },
        ]} />
      {hist && <Assignments emp={hist} onClose={() => setHist(null)} />}
    </>
  );
}

function Assignments({ emp, onClose }: { emp: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: contracts } = useContracts();
  const [contract, setContract] = useState("");
  const [post, setPost] = useState("");
  const [start, setStart] = useState("");
  const { data: posts } = useQuery({ queryKey: ["posts", contract], enabled: !!contract, queryFn: async () => (await supabase.from("posts").select("id, code").eq("contract_id", contract).eq("active", true).order("code")).data ?? [] });
  const add = async (): Promise<any> => {
    if (!contract || !start) return toast.error("Informe contrato e início.");
    const current = (emp.assignments ?? []).filter((a: any) => !a.end_date);
    for (const a of current) await supabase.from("employee_assignments").update({ end_date: start }).eq("id", a.id);
    const { error } = await supabase.from("employee_assignments").insert({ employee_id: emp.id, contract_id: contract, post_id: post || null, start_date: start });
    if (error) return toast.error(errMsg(error));
    toast.success("Vínculo registrado; vínculo anterior encerrado.");
    qc.invalidateQueries({ queryKey: ["crud", "employees"] });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Vínculos — {emp.registration} {emp.name}</DialogTitle></DialogHeader>
        <ul className="space-y-1 text-sm">
          {(emp.assignments ?? []).map((a: any) => <li key={a.id} className="rounded border p-2">{a.contract?.code} · posto {a.post?.code ?? "—"} · {fmtDate(a.start_date)} a {a.end_date ? fmtDate(a.end_date) : "atual"}</li>)}
          {!(emp.assignments ?? []).length && <li className="text-muted-foreground">Sem vínculos.</li>}
        </ul>
        {me?.has("admin") && (
          <div className="mt-2 grid gap-2 border-t pt-3">
            <p className="text-sm font-medium">Novo vínculo</p>
            <Select value={contract} onValueChange={setContract}><SelectTrigger><SelectValue placeholder="Contrato" /></SelectTrigger><SelectContent>{(contracts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent></Select>
            <Select value={post} onValueChange={setPost}><SelectTrigger><SelectValue placeholder="Posto" /></SelectTrigger><SelectContent>{(posts ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent></Select>
            <Field label="Início"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Button onClick={add}>Adicionar vínculo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
