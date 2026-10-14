export const TZ = "America/Sao_Paulo";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const brl = (cents: number) => brlFmt.format(cents / 100);
export const brlValue = (v: number | string | null | undefined) => brlFmt.format(Number(v ?? 0));

/** "2026-10-05" -> "05/10/2026" (no timezone shift). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");
export function hours(min: number): string {
  const h = min / 60;
  return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;
}
/** Today's date in São Paulo as YYYY-MM-DD. */
export function todaySP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

export const ATT_LABEL: Record<string, string> = {
  presente: "Presente",
  falta_integral: "Falta integral",
  falta_parcial: "Falta parcial",
  folga: "Folga",
  ferias: "Férias",
  afastamento: "Afastamento",
};
export const JUST_LABEL: Record<string, string> = {
  nao_apresentada: "Não apresentada",
  pendente: "Apresentada – pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};
export const COV_LABEL: Record<string, string> = {
  planejada: "Planejada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};
export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  conferente: "Conferente",
  financeiro: "Financeiro",
};
