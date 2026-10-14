import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/data";
import { useMe } from "@/hooks/use-auth";
import { DataTable, Field, PageHeader, type Col } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  half?: boolean;
}

export function CrudPage({
  title, description, table, select = "*", order, fields, cols, search, defaults, filter, extraActions, transform,
}: {
  title: string; description?: string; table: string; select?: string; order: string; fields: FieldDef[]; cols: Col<any>[];
  search: (r: any) => string; defaults?: Record<string, any>; filter?: (q: any) => any; extraActions?: ReactNode;
  transform?: (v: Record<string, any>) => Record<string, any>;
}) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canEdit = me?.has("admin");
  const { data, isLoading } = useQuery({
    queryKey: ["crud", table, select, filter?.toString()],
    queryFn: async () => {
      let q = (supabase.from as any)(table).select(select).order(order);
      if (filter) q = filter(q);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return data as any[];
    },
  });
  const [editing, setEditing] = useState<Record<string, any> | null>(null);

  const save = async () => {
    if (!editing) return;
    const payload: Record<string, any> = {};
    for (const f of fields) {
      let v = editing[f.key];
      if (v === "" || v === undefined) v = null;
      if (f.type === "number" && v !== null) v = Number(String(v).replace(",", "."));
      payload[f.key] = v;
    }
    const final = transform ? transform(payload) : payload;
    const res = editing.id
      ? await (supabase.from as any)(table).update(final).eq("id", editing.id)
      : await (supabase.from as any)(table).insert(final);
    if (res.error) return toast.error(errMsg(res.error));
    toast.success("Salvo.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["crud", table] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  return (
    <div>
      <PageHeader title={title} description={description}
        actions={<>{extraActions}{canEdit && <Button onClick={() => setEditing({ ...(defaults ?? {}) })}><Plus className="mr-2 h-4 w-4" />Novo</Button>}</>} />
      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <DataTable rows={data ?? []} rowKey={(r) => r.id} search={search}
          cols={[...cols, ...(canEdit ? [{ header: "", cell: (r: any) => <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}><Pencil className="h-4 w-4" /></Button> }] : [])]} />
      )}
      <p className="mt-3 text-xs text-muted-foreground">Registros já utilizados não são excluídos: altere a situação para inativo para preservar o histórico.{!canEdit && " Somente administradores podem editar cadastros."}</p>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} — {title}</DialogTitle></DialogHeader>
          <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} className={f.half ? "" : "col-span-2"}>
                {f.type === "select" ? (
                  <Select value={editing?.[f.key] != null ? String(editing[f.key]) : ""} onValueChange={(v) => setEditing({ ...editing, [f.key]: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === "number" ? "text" : f.type ?? "text"} inputMode={f.type === "number" ? "decimal" : undefined}
                    value={editing?.[f.key] != null ? String(editing[f.key]).slice(0, f.type === "time" ? 5 : undefined) : ""}
                    required={f.required} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
