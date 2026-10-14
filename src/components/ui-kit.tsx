import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useContracts } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const toneClass: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  info: "bg-info/10 text-info border-info/30",
  primary: "bg-primary/10 text-primary border-primary/30",
};
export type Tone = keyof typeof toneClass;

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", toneClass[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export const attTone = (s?: string | null): Tone =>
  !s ? "neutral" : s === "presente" ? "success" : s === "falta_integral" ? "danger" : s === "falta_parcial" ? "warning" : "info";

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  const bar: Record<string, string> = {
    neutral: "bg-border", success: "bg-success", warning: "bg-warning", danger: "bg-destructive", info: "bg-info", primary: "bg-primary",
  };
  return (
    <Card className="relative overflow-hidden">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar[tone])} />
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="num mt-1 text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ContractSelect({ value, onChange, allowAll }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const { data } = useContracts();
  return (
    <Select value={value || (allowAll ? "all" : "")} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">Todos os contratos</SelectItem>}
        {(data ?? []).map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function useDefaultContract(): [string, (v: string) => void] {
  const { data } = useContracts();
  const [v, setV] = useState("");
  const value = v || data?.[0]?.id || "";
  return [value, setV];
}

export interface Col<T> {
  header: string;
  cell: (r: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows, cols, search, pageSize = 15, empty = "Nenhum registro encontrado.", toolbar, rowKey,
}: {
  rows: T[]; cols: Col<T>[]; search?: (r: T) => string; pageSize?: number; empty?: string; toolbar?: ReactNode; rowKey: (r: T) => string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    if (!q || !search) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => search(r).toLowerCase().includes(s));
  }, [rows, q, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const p = Math.min(page, pages - 1);
  const slice = filtered.slice(p * pageSize, p * pageSize + pageSize);
  return (
    <Card>
      <CardContent className="p-0">
        {(search || toolbar) && (
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
            {search && (
              <div className="relative sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
              </div>
            )}
            <div className="flex flex-1 flex-wrap gap-2 sm:justify-end">{toolbar}</div>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>{cols.map((c) => <TableHead key={c.header} className={c.className}>{c.header}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {slice.length === 0 ? (
                <TableRow><TableCell colSpan={cols.length} className="py-10 text-center text-muted-foreground">{empty}</TableCell></TableRow>
              ) : (
                slice.map((r) => (
                  <TableRow key={rowKey(r)}>{cols.map((c) => <TableCell key={c.header} className={c.className}>{c.cell(r)}</TableCell>)}</TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{filtered.length} registro(s)</span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span>Página {p + 1} de {pages}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Próxima"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function DemoBadge({ show }: { show?: boolean | null }) {
  return show ? <Pill tone="warning">Fictício</Pill> : null;
}
