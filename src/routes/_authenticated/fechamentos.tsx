import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, loadPeriod } from "@/lib/data";
import { brl, brlValue, fmtDate, fmtDateTime, hours } from "@/lib/format";
import { useMe } from "@/hooks/use-auth";
import { useDefaultPeriod } from "@/hooks/use-period";
import { ContractSelect, DataTable, Field, PageHeader, Pill, Stat, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/fechamentos")({
  head: () => ({ meta: [{ title: "Fechamentos — Portal do Supervisor" }, { name: "description", content: "Fechamento mensal do faturamento por contrato." }] }),
  component: Fechamentos,
});

function Fechamentos() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const [applied, setApplied] = useState("");
  const [reason, setReason] = useState("");
  const [reopen, setReopen] = useState<any>(null);
  const [reopenReason, setReopenReason] = useState("");
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canClose = me?.has("admin", "financeiro");

  const { data: period } = useQuery({ queryKey: ["period", contract, from, to], queryFn: () => loadPeriod(contract, from, to), enabled: !!contract });
  const { data: closings } = useQuery({
    queryKey: ["closings", contract], enabled: !!contract,
    queryFn: async () => {
      const { data, error } = await supabase.from("closings").select("*").eq("contract_id", contract).order("period_start", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const t = period?.totals;
  const predicted = (t?.discountCents ?? 0) / 100;
  const appliedNum = applied === "" ? predicted : Number(applied.replace(",", "."));
  const differs = Math.abs(appliedNum - predicted) > 0.004;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["closings"] }); qc.invalidateQueries({ queryKey: ["period"] }); };

  const close = async () => {
    if (!period || !t) return;
    if (period.provisional) { toast.error("Há presenças, tratamentos ou divergências pendentes. Resolva antes de fechar."); return; }
    if (Number.isNaN(appliedNum)) { toast.error("Valor aplicado inválido."); return; }
    if (differs && reason.trim().length < 5) { toast.error("Informe o motivo da diferença entre previsto e aplicado."); return; }
    const overlap = (closings ?? []).find((c: any) => c.status === "fechado" && c.period_start <= to && c.period_end >= from);
    if (overlap) { toast.error(`Já existe fechamento para ${fmtDate(overlap.period_start)} a ${fmtDate(overlap.period_end)}.`); return; }
    const snapshot = { totals: t, rows: period.rows.length, coverages: period.coverages.length, dayRows: period.rows, coverageRows: period.coverages, treatments: period.treatments, generated_at: new Date().toISOString() };
    const existing = (closings ?? []).find((c: any) => c.status === "aberto" && c.period_start === from && c.period_end === to);
    const payload = {
      contract_id: contract, period_start: from, period_end: to, status: "fechado", predicted_discount: predicted,
      coverage_cost: t.coverageCostCents / 100, applied_discount: appliedNum, difference_reason: differs ? reason : null,
      snapshot: snapshot as any, closed_at: new Date().toISOString(), closed_by: me?.user.id ?? null,
    };
    const { error } = existing ? await supabase.from("closings").update(payload).eq("id", existing.id) : await supabase.from("closings").insert(payload);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Período fechado. Lançamentos do período estão bloqueados.");
    setApplied(""); setReason(""); refresh();
  };
  const doReopen = async () => {
    if (reopenReason.trim().length < 5) { toast.error("Informe o motivo da reabertura."); return; }
    const { error } = await supabase.from("closings").update({ status: "aberto", reopen_reason: reopenReason }).eq("id", reopen.id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Período reaberto."); setReopen(null); setReopenReason(""); refresh();
  };

  return (
    <div>
      <PageHeader title="Fechamentos" description="Ao fechar, presenças, coberturas e escalas do período ficam bloqueadas para edição." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Desconto previsto" value={brl(t?.discountCents ?? 0)} tone="danger" />
        <Stat label="Custo de coberturas" value={brl(t?.coverageCostCents ?? 0)} tone="info" />
        <Stat label="Presenças pendentes" value={period?.notInformed ?? 0} tone={period?.notInformed ? "warning" : "success"} />
        <Stat label="Divergências abertas" value={period?.openCalcDivergences ?? 0} tone={period?.openCalcDivergences ? "warning" : "success"} />
        <Stat label="Tratamento pendente" value={hours(t?.pendingMin ?? 0)} tone={t?.pendingMin ? "warning" : "success"} />
        <Stat label="Dispensa sem desconto" value={hours(t?.waivedMin ?? 0)} tone="info" />
      </div>
      {canClose && (
        <Card className="mb-6">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <Field label="Desconto aplicado (R$)">
              <Input inputMode="decimal" placeholder={predicted.toFixed(2).replace(".", ",")} value={applied} onChange={(e) => setApplied(e.target.value)} />
            </Field>
            <Field label={differs ? "Motivo da diferença (obrigatório)" : "Motivo da diferença"}>
              <Textarea rows={1} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!differs} />
            </Field>
            <Button onClick={close} disabled={!period || period.provisional}><Lock className="mr-2 h-4 w-4" />Fechar período</Button>
            {period?.provisional && <p className="text-sm text-warning-foreground sm:col-span-3">O período ainda está provisório e não pode ser fechado.</p>}
          </CardContent>
        </Card>
      )}
      <DataTable rows={closings ?? []} rowKey={(c: any) => c.id}
        cols={[
          { header: "Período", cell: (c: any) => `${fmtDate(c.period_start)} a ${fmtDate(c.period_end)}` },
          { header: "Situação", cell: (c: any) => c.status === "fechado" ? <Pill tone="success">Fechado</Pill> : <Pill tone="warning">Reaberto</Pill> },
          { header: "Previsto", cell: (c: any) => brlValue(c.predicted_discount), className: "num text-right" },
          { header: "Aplicado", cell: (c: any) => brlValue(c.applied_discount), className: "num text-right" },
          { header: "Coberturas", cell: (c: any) => brlValue(c.coverage_cost), className: "num text-right" },
          { header: "Motivo / reabertura", cell: (c: any) => <span className="text-xs text-muted-foreground">{[c.difference_reason, c.reopen_reason && `Reaberto: ${c.reopen_reason}`].filter(Boolean).join(" · ") || "—"}</span> },
          { header: "Fechado em", cell: (c: any) => fmtDateTime(c.closed_at) },
          { header: "", cell: (c: any) => me?.has("admin") && c.status === "fechado" ? <Button size="sm" variant="outline" onClick={() => setReopen(c)}><Unlock className="mr-1 h-3 w-3" />Reabrir</Button> : null },
        ]} />
      <Dialog open={!!reopen} onOpenChange={(o) => !o && setReopen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reabrir período</DialogTitle></DialogHeader>
          <Field label="Motivo (registrado na auditoria)"><Textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setReopen(null)}>Cancelar</Button><Button onClick={doReopen}>Reabrir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
