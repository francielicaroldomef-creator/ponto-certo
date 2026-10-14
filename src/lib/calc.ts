// Centralized calculation engine. All screens, reports and exports MUST use these functions.
// Durations are integer minutes; money is integer cents (rounded only at the per-record result).

export type Interval = [number, number];

export function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m || 0);
}
export function minToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
export function toCents(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  return Math.round(Number(v) * 100);
}

export function normalize(list: Interval[]): Interval[] {
  const s = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
export function subtract(list: Interval[], cut: Interval[]): Interval[] {
  let cur = normalize(list);
  for (const [ca, cb] of normalize(cut)) {
    const next: Interval[] = [];
    for (const [a, b] of cur) {
      if (cb <= a || ca >= b) next.push([a, b]);
      else {
        if (ca > a) next.push([a, ca]);
        if (cb < b) next.push([cb, b]);
      }
    }
    cur = next;
  }
  return cur;
}
export function intersect(x: Interval[], y: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of normalize(x))
    for (const [c, d] of normalize(y)) {
      const s = Math.max(a, c);
      const e = Math.min(b, d);
      if (e > s) out.push([s, e]);
    }
  return normalize(out);
}
export function total(list: Interval[]): number {
  return normalize(list).reduce((acc, [a, b]) => acc + (b - a), 0);
}

/** Working intervals of a shift, excluding the lunch break. */
export function workIntervals(start: string, end: string, bs?: string | null, be?: string | null): Interval[] {
  const s = toMin(start)!;
  const e = toMin(end)!;
  const b1 = toMin(bs ?? null);
  const b2 = toMin(be ?? null);
  const base: Interval[] = [[s, e]];
  return b1 !== null && b2 !== null ? subtract(base, [[b1, b2]]) : base;
}

export type AttendanceStatus =
  | "presente"
  | "falta_integral"
  | "falta_parcial"
  | "folga"
  | "ferias"
  | "afastamento";

export interface ScheduleLike {
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
}
export interface AttendanceLike {
  status: AttendanceStatus;
  absent_intervals?: { start: string; end: string }[] | null;
  hour_value?: number | string | null;
}
export interface CoverageLike {
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  status: string;
  agreed_value: number | string;
}

/** Employee absence (minutes) — folga/férias/afastamento are NOT employee absences. */
export function absenceIntervals(s: ScheduleLike, a: AttendanceLike | null | undefined): Interval[] {
  if (!a) return [];
  const work = workIntervals(s.start_time, s.end_time, s.break_start, s.break_end);
  if (a.status === "falta_integral") return work;
  if (a.status === "falta_parcial") {
    const given: Interval[] = (a.absent_intervals ?? []).map((i) => [toMin(i.start)!, toMin(i.end)!]);
    return intersect(given, work);
  }
  return [];
}

/** Post-coverage need: absences, plus férias/afastamento (post still required by contract). Folga = no need. */
export function needIntervals(s: ScheduleLike, a: AttendanceLike | null | undefined): Interval[] {
  if (!a) return [];
  if (a.status === "ferias" || a.status === "afastamento")
    return workIntervals(s.start_time, s.end_time, s.break_start, s.break_end);
  return absenceIntervals(s, a);
}

export function coverageIntervals(c: CoverageLike): Interval[] {
  return workIntervals(c.start_time, c.end_time, c.break_start, c.break_end);
}

/** Suggested value for a coverage: full shift → day rate; otherwise hours × partial hourly rate. */
export function suggestCoverageCents(minutes: number, shiftMinutes: number, dayRate: number | string, hourRate: number | string): number {
  if (minutes >= shiftMinutes) return toCents(dayRate);
  return Math.round((minutes * toCents(hourRate)) / 60);
}

export interface PostDayResult {
  requiredMin: number;
  absentMin: number;
  needMin: number;
  coveredMin: number;
  uncoveredMin: number;
  discountCents: number;
  coverageCostCents: number;
  uncoveredIntervals: Interval[];
}

/** Result for one scheduled person/post/day given the coverages of that post on that day. */
export function computePostDay(s: ScheduleLike, a: AttendanceLike | null | undefined, coverages: CoverageLike[]): PostDayResult {
  const work = workIntervals(s.start_time, s.end_time, s.break_start, s.break_end);
  const absent = absenceIntervals(s, a);
  const need = needIntervals(s, a);
  const realized = coverages.filter((c) => c.status === "realizada");
  const covUnion = normalize(realized.flatMap(coverageIntervals));
  const covered = intersect(need, covUnion);
  const uncovered = subtract(need, covered);
  const uncoveredMin = total(uncovered);
  const hourCents = toCents(a?.hour_value ?? 0);
  return {
    requiredMin: total(work),
    absentMin: total(absent),
    needMin: total(need),
    coveredMin: total(covered),
    uncoveredMin,
    discountCents: Math.round((uncoveredMin * hourCents) / 60),
    coverageCostCents: realized.reduce((acc, c) => acc + toCents(c.agreed_value), 0),
    uncoveredIntervals: uncovered,
  };
}

export interface Totals {
  integral: number;
  partial: number;
  absentMin: number;
  coveredMin: number;
  uncoveredMin: number;
  discountCents: number;
  coverageCostCents: number;
  impactCents: number;
}
export function emptyTotals(): Totals {
  return { integral: 0, partial: 0, absentMin: 0, coveredMin: 0, uncoveredMin: 0, discountCents: 0, coverageCostCents: 0, impactCents: 0 };
}
export function addToTotals(t: Totals, a: AttendanceLike | null | undefined, r: PostDayResult): Totals {
  if (a?.status === "falta_integral") t.integral++;
  if (a?.status === "falta_parcial") t.partial++;
  t.absentMin += r.absentMin;
  t.coveredMin += r.coveredMin;
  t.uncoveredMin += r.uncoveredMin;
  t.discountCents += r.discountCents;
  t.coverageCostCents += r.coverageCostCents;
  t.impactCents = t.discountCents + t.coverageCostCents;
  return t;
}
