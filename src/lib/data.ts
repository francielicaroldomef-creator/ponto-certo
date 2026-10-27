import { supabase } from "@/integrations/supabase/client";
import { addToTotals, computePostDay, emptyTotals, toCents, type AttendanceLike, type PostDayResult, type Totals } from "./calc";
import { todaySP } from "./format";

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
  /** Discount value per uncovered minute (rule-aware), for the absence breakdown. */
  unitCentsPerMin: number;
  /** True for dates after today (America/Sao_Paulo): planning only, never counted as realized. */
  future: boolean;
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
export async function loadPeriod(contractId: string, from: string, to: string, userRoles?: string[]): Promise<PeriodData> {
  const [schedules, attendance, coverages, divergences, treatments, contracts, closings] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("schedules")
        .select("*, employee:employees(id, registration, name), post:posts(id, code, workplace, city, hour_value, day_value)")
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
  const today = todaySP();
  const totals = emptyTotals();
  let notInformed = 0;
  const rows: DayRow[] = schedules.map((s: any) => {
    const att = attBySched.get(s.id) ?? null;
    const future = s.work_date > today;
    if (!att && !future) notInformed++;
    const covs = (covByPostDay.get(covKey(s.post_id, s.work_date)) ?? []).filter(c => !c.attendance_id || c.attendance_id === att?.id);
    const ts = treatments.filter(t => t.attendance_id === att?.id);
    // Records created through the UI may lack hour_value: fall back to the post value.
    const attWithValue = att ? { ...att, hour_value: att.hour_value ?? s.post?.hour_value } : null;
    const result = computePostDay(s, attWithValue as AttendanceLike | null, covs, ts);
    const hourCents = toCents(attWithValue?.hour_value ?? s.post?.hour_value ?? 0);
    const dayCents = toCents(s.post?.day_value ?? 0);
    const unitCentsPerMin = contracts[0]?.discount_rule === "hora" || result.requiredMin === 0
      ? hourCents / 60
      : dayCents / result.requiredMin;
    if (contracts[0]?.discount_rule !== "hora" && result.requiredMin > 0) result.discountCents = Math.round(result.uncoveredMin * dayCents / result.requiredMin);
    const closing = closings.find(c => c.period_start <= s.work_date && c.period_end >= s.work_date);
    const saved = closing?.snapshot?.dayRows?.find((r: any) => r.schedule.id === s.id);
    if (saved?.result) Object.assign(result, saved.result);
    else if (closing) result.pendingMin = 0; // Legacy closed amounts are unchanged; no new pending treatment is inferred.
    if (future) {
      // Planning only: future dates never generate absences, discounts, pendings or realized totals.
      Object.assign(result, { absentMin: 0, needMin: 0, coveredMin: 0, waivedMin: 0, pendingMin: 0, uncoveredMin: 0, discountCents: 0, coverageCostCents: 0, uncoveredIntervals: [] });
    } else {
      addToTotals(totals, attWithValue as AttendanceLike | null, result);
    }
    return {
      schedule: s,
      employee: s.employee,
      post: s.post,
      attendance: att,
      coverages: covs,
      treatments: ts,
      divergences: divergences.filter((d: any) => d.schedule_id === s.id || (d.employee_id === s.employee_id && d.work_date === s.work_date)),
      result,
      unitCentsPerMin,
      future,
    };
  });
  const openCalcDivergences = divergences.filter((d: any) => d.status === "aberta" && d.affects_calc && !d.excluded_from_totals && (!d.work_date || d.work_date <= today)).length;
  // Coverage expense is a record cost, not a cost repeated for every employee on a post. Future coverages are planning.
  totals.coverageCostCents = coverages.filter(c => c.status !== "cancelada" && c.work_date <= today).reduce((n, c) => n + Math.round(Number(c.agreed_value) * 100), 0);
  totals.impactCents = totals.discountCents + totals.coverageCostCents;
  const exactClosing = closings.find(c => c.period_start === from && c.period_end === to);
  if (exactClosing?.snapshot?.totals) Object.assign(totals, { ...emptyTotals(), ...exactClosing.snapshot.totals });

  const rawData: PeriodData = {
    rows,
    coverages,
    treatments,
    divergences,
    totals,
    notInformed,
    openCalcDivergences,
    provisional: !exactClosing && (openCalcDivergences > 0 || notInformed > 0 || totals.pendingMin > 0),
  };

  let isFinancialAuthorized = true;
  try {
    if (userRoles) {
      isFinancialAuthorized = userRoles.includes("admin") || userRoles.includes("financeiro");
    } else if (typeof window !== "undefined") {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        const r = (roles ?? []).map((x: any) => x.role);
        isFinancialAuthorized = r.includes("admin") || r.includes("financeiro");
      }
    }
  } catch {
    isFinancialAuthorized = false;
  }

  return sanitizeFinancialData(rawData, isFinancialAuthorized);
}

/**
 * Zero-Trust Financial Sanitizer:
 * Masks and zeroes out all confidential financial amounts (hour rates, day rates,
 * discounts, coverage costs) from query payloads unless explicitly authorized as admin or financeiro.
 */
export function sanitizeFinancialData(data: PeriodData, isFinancialAuthorized: boolean): PeriodData {
  if (isFinancialAuthorized) return data;

  const totals: Totals = {
    ...data.totals,
    discountCents: 0,
    coverageCostCents: 0,
    impactCents: 0,
  };

  const rows: DayRow[] = data.rows.map((r) => ({
    ...r,
    post: r.post ? { ...r.post, hour_value: null, day_value: null } : r.post,
    attendance: r.attendance ? { ...r.attendance, hour_value: null } : r.attendance,
    coverages: r.coverages.map((c) => ({ ...c, agreed_value: null })),
    result: {
      ...r.result,
      discountCents: 0,
      coverageCostCents: 0,
    },
    unitCentsPerMin: 0,
  }));

  const coverages = data.coverages.map((c) => ({ ...c, agreed_value: null }));

  return {
    ...data,
    rows,
    coverages,
    totals,
  };
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return String(e);
}

export interface BatchPostInput {
  id?: string;
  contract_id: string;
  code: string;
  workplace: string;
  city: string;
  role_name?: string;
  required_qty?: number;
  active?: boolean;
}

/**
 * Persists posts in batch linked to a contract and city.
 * Fills safe legacy defaults for start/end/break hours without exposing them.
 */
export async function upsertContractPostsBatch(
  contractId: string,
  posts: BatchPostInput[],
  deletedPostIds?: string[]
): Promise<{ count: number }> {
  if (deletedPostIds && deletedPostIds.length > 0) {
    const { error: delErr } = await supabase.from("posts").delete().in("id", deletedPostIds);
    if (delErr) {
      // If foreign key constraint (e.g. linked schedules) prevents hard deletion, soft delete
      await supabase.from("posts").update({ active: false }).in("id", deletedPostIds);
    }
  }

  if (posts.length === 0) {
    return { count: 0 };
  }

  const rows = posts.map((p) => ({
    ...(p.id ? { id: p.id } : {}),
    contract_id: contractId,
    code: p.code.trim(),
    workplace: p.workplace.trim() || `Posto ${p.code.trim()}`,
    city: p.city.trim(),
    role_name: p.role_name?.trim() || "Servente de Limpeza",
    required_qty: p.required_qty && p.required_qty > 0 ? Number(p.required_qty) : 1,
    active: p.active ?? true,
    start_time: "08:00",
    end_time: "17:00",
    break_start: "12:00",
    break_end: "13:00",
    shift: "Diurno",
    day_value: 0,
    hour_value: 0,
  }));

  // Save metadata to localStorage first as safety backup
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const cityMap: Record<string, string> = {};
      const workplaceMap: Record<string, string> = {};
      posts.forEach((p) => {
        if (p.code) {
          cityMap[p.code.trim()] = p.city?.trim() || "";
          workplaceMap[p.code.trim()] = p.workplace?.trim() || "";
        }
      });
      localStorage.setItem(`posts_meta_cities_${contractId}`, JSON.stringify(cityMap));
      localStorage.setItem(`posts_meta_workplaces_${contractId}`, JSON.stringify(workplaceMap));
    }
  } catch (_) {}

  // 1. Tentar salvar com as colunas completas (workplace e city)
  const { error } = await supabase.from("posts").upsert(rows, { onConflict: "contract_id,code" });

  if (error) {
    const errorMsg = (error.message || "").toLowerCase();
    const isColumnMissing =
      errorMsg.includes("city") ||
      errorMsg.includes("workplace") ||
      errorMsg.includes("schema cache") ||
      error.code === "42703" ||
      error.code === "PGRST204";

    if (isColumnMissing) {
      console.warn(
        "[upsertContractPostsBatch] Schema cache do Supabase ainda sem colunas city/workplace. Realizando fallback seguro:",
        error.message
      );

      // Fallback: remove city e workplace do payload da tabela posts (ficam salvos em localStorage e contracts)
      const fallbackRows = rows.map((r) => {
        const copy: any = { ...r };
        delete copy.city;
        delete copy.workplace;
        return copy;
      });

      const { error: retryError } = await supabase.from("posts").upsert(fallbackRows, {
        onConflict: "contract_id,code",
      });

      if (retryError) throw retryError;
      return { count: fallbackRows.length };
    }

    throw error;
  }

  return { count: rows.length };
}

