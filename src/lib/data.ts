import { supabase } from "@/integrations/supabase/client";
import { addToTotals, computePostDay, emptyTotals, type AttendanceLike, type PostDayResult, type Totals } from "./calc";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Fetch all rows past the 1000-row API limit. */
export async function fetchAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export interface DayRow {
  schedule: any;
  employee: any;
  post: any;
  attendance: any | null;
  coverages: any[];
  treatments: any[];
  divergences: any[];
  result: PostDayResult;
}

export interface PeriodData {
  rows: DayRow[];
  coverages: any[];
  treatments: any[];
  divergences: any[];
  totals: Totals;
  notInformed: number;
  openCalcDivergences: number;
  provisional: boolean;
}

/** Load and compute everything for a contract and date range. Single source for all screens/reports. */
export async function loadPeriod(contractId: string, from: string, to: string): Promise<PeriodData> {
  const [schedules, attendance, coverages, divergences, treatments, contracts, closings] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("schedules")
        .select("*, employee:employees(id, registration, name), post:posts(id, code, hour_value, day_value)")
        .eq("contract_id", contractId)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from("attendance").select("*").eq("contract_id", contractId).gte("work_date", from).lte("work_date", to).range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("coverages")
        .select("*, day_worker:day_workers(code, name), employee:employees(registration, name), supervisor:profiles!coverages_supervisor_id_fkey(full_name), post:posts(code)")
        .eq("contract_id", contractId)
        .gte("work_date", from)
        .lte("work_date", to)
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("divergences")
        .select("*, employee:employees(registration, name)")
        .eq("contract_id", contractId)
        .gte("work_date", from)
        .lte("work_date", to)
        .range(a, b),
    ),
    fetchAll((a, b) => supabase.from("absence_treatments").select("*").eq("contract_id", contractId).gte("work_date", from).lte("work_date", to).range(a, b)),
    fetchAll((a, b) => supabase.from("contracts").select("discount_rule").eq("id", contractId).range(a, b)),
    fetchAll((a, b) => supabase.from("closings").select("*").eq("contract_id", contractId).eq("status", "fechado").lte("period_start", to).gte("period_end", from).range(a, b)),
  ]);
  const attBySched = new Map(attendance.map((a: any) => [a.schedule_id, a]));
  const covKey = (postId: string, d: string) => `${postId}|${d}`;
  const covByPostDay = new Map<string, any[]>();
  for (const c of coverages) {
    const k = covKey(c.post_id, c.work_date);
    covByPostDay.set(k, [...(covByPostDay.get(k) ?? []), c]);
  }
  const totals = emptyTotals();
  let notInformed = 0;
  const rows: DayRow[] = schedules.map((s: any) => {
    const att = attBySched.get(s.id) ?? null;
    if (!att) notInformed++;
    const covs = (covByPostDay.get(covKey(s.post_id, s.work_date)) ?? []).filter(c => !c.attendance_id || c.attendance_id === att?.id);
    const ts = treatments.filter(t => t.attendance_id === att?.id);
    const result = computePostDay(s, att as AttendanceLike | null, covs, ts);
    if (contracts[0]?.discount_rule !== "hora" && result.requiredMin > 0) result.discountCents = Math.round(result.uncoveredMin * Math.round(Number(s.post?.day_value ?? 0) * 100) / result.requiredMin);
    const closing = closings.find(c => c.period_start <= s.work_date && c.period_end >= s.work_date);
    const saved = closing?.snapshot?.dayRows?.find((r: any) => r.schedule.id === s.id);
    if (saved?.result) Object.assign(result, saved.result);
    else if (closing) result.pendingMin = 0; // Legacy closed amounts are unchanged; no new pending treatment is inferred.
    addToTotals(totals, att as AttendanceLike | null, result);
    return {
      schedule: s,
      employee: s.employee,
      post: s.post,
      attendance: att,
      coverages: covs,
      treatments: ts,
      divergences: divergences.filter((d: any) => d.schedule_id === s.id || (d.employee_id === s.employee_id && d.work_date === s.work_date)),
      result,
    };
  });
  const openCalcDivergences = divergences.filter((d: any) => d.status === "aberta" && d.affects_calc && !d.excluded_from_totals).length;
  // Coverage expense is a record cost, not a cost repeated for every employee on a post.
  totals.coverageCostCents = coverages.filter(c => c.status !== "cancelada").reduce((n, c) => n + Math.round(Number(c.agreed_value) * 100), 0);
  totals.impactCents = totals.discountCents + totals.coverageCostCents;
  const exactClosing = closings.find(c => c.period_start === from && c.period_end === to);
  if (exactClosing?.snapshot?.totals) Object.assign(totals, { ...emptyTotals(), ...exactClosing.snapshot.totals });
  return {
    rows,
    coverages,
    treatments,
    divergences,
    totals,
    notInformed,
    openCalcDivergences,
    provisional: !exactClosing && (openCalcDivergences > 0 || notInformed > 0 || totals.pendingMin > 0),
  };
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return String(e);
}
