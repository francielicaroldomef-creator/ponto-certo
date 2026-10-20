import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, errMsg } from "@/lib/data";
import { fmtDate, hhmm } from "@/lib/format";
import { ContractSelect, DataTable, PageHeader, useDefaultContract } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/escalas")({
  head: () => ({ meta: [{ title: "Escalas — Portal do Supervisor" }] }),
  component: Escalas,
});

function Escalas() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod(true);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["schedules", contract, from, to], enabled: !!contract,
    queryFn: () => fetchAll((a, b) => supabase.from("schedules").select("*, employee:employees(registration, name), post:posts(code)").eq("contract_id", contract).gte("work_date", from).lte("work_date", to).order("work_date").range(a, b)),
  });
  const generate = async (): Promise<any> => {
    const { data: n, error } = await supabase.rpc("generate_schedules", { _contract: contract, _from: from, _to: to });
    if (error) return toast.error(errMsg(error));
    toast.success(`${n} escala(s) criada(s). Já existentes foram mantidas.`);
    qc.invalidateQueries({ queryKey: ["schedules"] });
    qc.invalidateQueries({ queryKey: ["period"] });
  };
  return (
    <div>
      <PageHeader title="Escalas" description="Gerada a partir dos vínculos ativos e dos dias de operação do contrato (sem calendário de feriados na demonstração)."
        actions={<Button onClick={generate} disabled={!contract}><CalendarPlus className="mr-2 h-4 w-4" />Gerar escala do período</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <ContractSelect value={contract} onChange={setContract} />
        <DatePicker value={from} onChange={setFrom} label="De" />
        <DatePicker value={to} onChange={setTo} label="Até" />
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <DataTable rows={data ?? []} rowKey={(r: any) => r.id} pageSize={30} search={(r: any) => `${r.employee?.registration} ${r.employee?.name} ${r.post?.code} ${fmtDate(r.work_date)}`}
          cols={[
            { header: "Data", cell: (r: any) => fmtDate(r.work_date) },
            { header: "Matrícula", cell: (r: any) => <span className="font-mono text-xs">{r.employee?.registration}</span> },
            { header: "Funcionário", cell: (r: any) => r.employee?.name },
            { header: "Posto", cell: (r: any) => r.post?.code },
            { header: "Horário", cell: (r: any) => `${hhmm(r.start_time)}–${hhmm(r.end_time)}` },
            { header: "Intervalo", cell: (r: any) => `${hhmm(r.break_start)}–${hhmm(r.break_end)}` },
          ]} />
      )}
    </div>
  );
}
