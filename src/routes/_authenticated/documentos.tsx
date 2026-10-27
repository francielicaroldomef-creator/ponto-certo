import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fetchAll } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useDefaultPeriod } from "@/hooks/use-period";
import { pdfPagesText, parseTimesheet, sha256 } from "@/lib/timesheet";
import { ContractSelect, DataTable, DemoBadge, Field, PageHeader, Pill, useDefaultContract, type Tone } from "@/components/ui-kit";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/hooks/use-auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos de ponto — Portal do Supervisor" }, { name: "description", content: "Envio e extração de cartões de ponto em PDF." }] }),
  component: Documentos,
});

const STATUS: Record<string, [string, Tone]> = {
  enviado: ["Enviado", "info"],
  processado: ["Processado", "success"],
  conferencia_manual: ["Conferência manual", "warning"],
  erro: ["Erro", "danger"],
  duplicado: ["Duplicado", "neutral"],
};

function Documentos() {
  const [contract, setContract] = useDefaultContract();
  const [from, to, setFrom, setTo] = useDefaultPeriod();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<any>(null);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canWrite = me?.has("admin", "conferente", "supervisor");

  const { data: docs } = useQuery({
    queryKey: ["docs", contract],
    enabled: !!contract,
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_docs").select("*").eq("contract_id", contract).order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: punches } = useQuery({
    queryKey: ["punches", view?.id],
    enabled: !!view,
    queryFn: async () => {
      const { data, error } = await supabase.from("punches").select("*, employee:employees(registration, name)").eq("doc_id", view.id).order("work_date");
      if (error) throw error;
      return data;
    },
  });

  const process = async () => {
    if (!file || !contract) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("Envie um arquivo PDF."); return; }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const hash = await sha256(buf);
      const { data: dup } = await supabase.from("timesheet_docs").select("id, file_name").eq("contract_id", contract).eq("file_hash", hash).limit(1);
      const path = `${contract}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      if (dup && dup.length) {
        await supabase.from("timesheet_docs").insert({ contract_id: contract, period_start: from, period_end: to, file_name: file.name, file_hash: hash, uploaded_by: me?.user.id ?? null, status: "duplicado", errors: `Mesmo arquivo já enviado (${dup[0]!.file_name}).` });
        toast.warning("Arquivo já enviado anteriormente — registrado como duplicado.");
        return;
      }
      const up = await supabase.storage.from("timesheets").upload(path, file, { contentType: "application/pdf" });
      const { data: doc, error: e1 } = await supabase.from("timesheet_docs").insert({
        contract_id: contract, period_start: from, period_end: to, file_name: file.name, file_hash: hash,
        file_path: up.error ? null : path, uploaded_by: me?.user.id ?? null, status: "enviado",
        errors: up.error ? `Arquivo não armazenado: ${up.error.message}` : null,
      }).select().single();
      if (e1) throw e1;

      let pages: string[][] = [];
      try { pages = await pdfPagesText(buf); } catch (e) {
        await supabase.from("timesheet_docs").update({ status: "erro", errors: `Falha ao ler PDF: ${errMsg(e)}` }).eq("id", doc.id);
        toast.error("Não foi possível ler o PDF.");
        return;
      }
      const textLen = pages.flat().join("").trim().length;
      const extracted = parseTimesheet(pages, Number(from.slice(0, 4))).filter((p) => p.work_date >= from && p.work_date <= to);
      if (textLen < 20 || extracted.length === 0) {
        await supabase.from("timesheet_docs").update({ status: "conferencia_manual", extraction: { pages: pages.length, rows: 0 }, errors: textLen < 20 ? "PDF sem texto (digitalizado). OCR não configurado — conferir manualmente." : "Nenhuma linha de ponto reconhecida no período." }).eq("id", doc.id);
        await supabase.from("divergences").insert({ contract_id: contract, doc_id: doc.id, kind: "documento_ilegivel", reason: "Documento exige conferência manual.", affects_calc: false });
        toast.warning("Documento enviado para conferência manual.");
        return;
      }

      const [emps, schedules, att] = await Promise.all([
        fetchAll((a, b) => supabase.from("employees").select("id, registration, name").range(a, b)),
        fetchAll((a, b) => supabase.from("schedules").select("id, employee_id, work_date").eq("contract_id", contract).gte("work_date", from).lte("work_date", to).range(a, b)),
        fetchAll((a, b) => supabase.from("attendance").select("schedule_id, status").eq("contract_id", contract).gte("work_date", from).lte("work_date", to).range(a, b)),
      ]);
      const byReg = new Map(emps.map((e: any) => [String(e.registration), e]));
      const byName = new Map(emps.map((e: any) => [String(e.name).toLowerCase(), e]));
      const schedKey = new Map(schedules.map((s: any) => [`${s.employee_id}|${s.work_date}`, s]));
      const attBy = new Map(att.map((a: any) => [a.schedule_id, a.status]));
      const rows: any[] = [];
      const divs: any[] = [];
      for (const p of extracted) {
        let emp: any = p.registration ? byReg.get(p.registration) : null;
        let conf = "matricula";
        if (!emp && p.name) { emp = byName.get(p.name.toLowerCase()); conf = emp ? "nome_incerto" : "desconhecido"; }
        if (!emp) conf = "desconhecido";
        rows.push({ doc_id: doc.id, contract_id: contract, employee_id: emp?.id ?? null, registration: p.registration, name: p.name, work_date: p.work_date, marks: p.marks, page: p.page, match_confidence: conf });
        const base = { contract_id: contract, doc_id: doc.id, page: p.page, work_date: p.work_date, employee_id: emp?.id ?? null };
        if (!emp) { divs.push({ ...base, kind: "funcionario_nao_identificado", reason: `Matrícula/nome não encontrado: ${p.registration ?? p.name ?? "?"}` }); continue; }
        if (conf === "nome_incerto") divs.push({ ...base, kind: "identificacao_incerta", reason: `Identificado só pelo nome (${p.name}).`, affects_calc: false });
        const s: any = schedKey.get(`${emp.id}|${p.work_date}`);
        const st = s ? attBy.get(s.id) : undefined;
        if (p.marks.length % 2 === 1) divs.push({ ...base, schedule_id: s?.id ?? null, kind: "marcacao_impar", reason: `Número ímpar de marcações (${p.marks.join(" ")}).` });
        if (s && p.marks.length === 0 && st === "presente") divs.push({ ...base, schedule_id: s.id, kind: "presenca_sem_marcacao", reason: "Lançado como presente, mas sem marcações no cartão." });
        if (s && p.marks.length > 0 && st === "falta_integral") divs.push({ ...base, schedule_id: s.id, kind: "marcacao_em_falta", reason: `Lançado como falta integral, mas há marcações (${p.marks.join(" ")}).` });
        if (!s && p.marks.length > 0) divs.push({ ...base, kind: "marcacao_fora_escala", reason: "Marcações em dia sem escala.", affects_calc: false });
      }
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("punches").insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      if (divs.length) {
        const { error } = await supabase.from("divergences").insert(divs);
        if (error) throw error;
      }
      await supabase.from("timesheet_docs").update({ status: "processado", extraction: { pages: pages.length, rows: rows.length, divergences: divs.length } }).eq("id", doc.id);
      toast.success(`${rows.length} linha(s) extraída(s), ${divs.length} divergência(s) gerada(s).`);
      setFile(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["docs"] });
      qc.invalidateQueries({ queryKey: ["period"] });
    }
  };

  const openFile = async (d: any) => {
    const { data, error } = await supabase.storage.from("timesheets").createSignedUrl(d.file_path, 60);
    if (error) toast.error(errMsg(error)); else if (data) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <PageHeader title="Documentos de ponto" description="Envie cartões de ponto em PDF. O sistema extrai as marcações e gera divergências para conferência." />
      <div className="mb-4"><ContractSelect value={contract} onChange={setContract} /></div>
      {canWrite && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <Field label="Arquivo PDF">
              <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <DatePicker value={from} onChange={setFrom} label="Período de" />
            <DatePicker value={to} onChange={setTo} label="até" />
            <Button disabled={!file || busy} onClick={process}><Upload className="mr-2 h-4 w-4" />{busy ? "Processando..." : "Enviar e extrair"}</Button>
          </CardContent>
        </Card>
      )}
      <DataTable rows={docs ?? []} rowKey={(d: any) => d.id} search={(d: any) => d.file_name}
        cols={[
          { header: "Arquivo", cell: (d: any) => <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.file_name} <DemoBadge show={d.is_demo} /></span> },
          { header: "Período", cell: (d: any) => `${fmtDate(d.period_start)} a ${fmtDate(d.period_end)}` },
          { header: "Enviado em", cell: (d: any) => fmtDateTime(d.uploaded_at) },
          { header: "Situação", cell: (d: any) => { const s = STATUS[d.status] ?? [d.status, "neutral"]; return <Pill tone={s[1]}>{s[0]}</Pill>; } },
          { header: "Extração", cell: (d: any) => d.extraction ? `${d.extraction.rows ?? 0} linhas · ${d.extraction.divergences ?? 0} diverg.` : "—" },
          { header: "Observação", cell: (d: any) => <span className="text-xs text-muted-foreground">{d.errors ?? ""}</span> },
          { header: "", cell: (d: any) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setView(d)}>Marcações</Button>
              {d.file_path && <Button size="sm" variant="ghost" onClick={() => openFile(d)}>Abrir PDF</Button>}
            </div>
          ) },
        ]} />
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Marcações extraídas — {view?.file_name}</DialogTitle></DialogHeader>
          <DataTable rows={punches ?? []} rowKey={(p: any) => p.id} pageSize={10} search={(p: any) => `${p.registration} ${p.name} ${p.employee?.name ?? ""}`}
            cols={[
              { header: "Data", cell: (p: any) => fmtDate(p.work_date) },
              { header: "Funcionário", cell: (p: any) => p.employee ? `${p.employee.registration} — ${p.employee.name}` : <span className="text-destructive">{p.registration ?? p.name ?? "Não identificado"}</span> },
              { header: "Marcações", cell: (p: any) => <span className="num">{(p.marks ?? []).join("  ") || "—"}</span> },
              { header: "Pág.", cell: (p: any) => p.page ?? "—" },
              { header: "Identificação", cell: (p: any) => <Pill tone={p.match_confidence === "matricula" ? "success" : p.match_confidence === "nome_incerto" ? "warning" : "danger"}>{p.match_confidence === "matricula" ? "Matrícula" : p.match_confidence === "nome_incerto" ? "Nome (incerto)" : "Desconhecido"}</Pill> },
            ]} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
