import { supabase } from "@/integrations/supabase/client";
import {
  intersect,
  needIntervals,
  normalize,
  subtract,
  total,
  workIntervals,
  minToHHMM,
  computePostDay,
  type AttendanceLike,
  type ScheduleLike,
  type Interval,
} from "./calc";

export interface TreatmentRecord {
  id?: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  status?: string;
  kind?: string;
  coverer_type?: string;
  active?: boolean;
}

export interface ConflictingRecordInfo {
  id: string;
  isCoverage: boolean;
  kind: string;
  label: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  overlapMinutes: number;
}

export interface LegacyConflictGroup {
  id1: string;
  id2: string;
  isCoverage1: boolean;
  isCoverage2: boolean;
  label1: string;
  label2: string;
  time1: string;
  time2: string;
  overlapMinutes: number;
}

/** Finds all active records of the same absence that overlap the candidate period. */
export function findConflictingTreatments(
  schedule: ScheduleLike,
  attendance: AttendanceLike,
  candidate: TreatmentRecord,
  coverages: TreatmentRecord[],
  treatments: TreatmentRecord[],
  isCoverage: boolean
): ConflictingRecordInfo[] {
  if ((isCoverage && candidate.status === "cancelada") || (!isCoverage && candidate.active === false)) return [];
  const need = needIntervals(schedule, attendance);
  const intervals = (r: TreatmentRecord, coverage: boolean) =>
    intersect(need, workIntervals(r.start_time, r.end_time, coverage ? r.break_start : null, coverage ? r.break_end : null));
  const proposed = intervals(candidate, isCoverage);

  const conflicts: ConflictingRecordInfo[] = [];

  for (const [records, coverage] of [[coverages, true], [treatments, false]] as const) {
    for (const r of records) {
      if (coverage ? r.status === "cancelada" : r.active === false) continue;
      if (coverage === isCoverage && candidate.id && r.id === candidate.id) continue;
      const overlap = intersect(proposed, intervals(r, coverage));
      const overlapMin = total(overlap);
      if (overlapMin === 0) continue;
      const label = coverage
        ? r.coverer_type === "funcionario"
          ? "cobertura por funcionário"
          : "cobertura por diarista"
        : r.kind === "dispensa"
          ? "dispensa sem desconto"
          : "Sem cobertura, com desconto";
      conflicts.push({
        id: r.id ?? "",
        isCoverage: coverage,
        kind: coverage ? r.coverer_type ?? "cobertura" : r.kind ?? "desconto",
        label,
        start_time: r.start_time,
        end_time: r.end_time,
        break_start: r.break_start,
        break_end: r.break_end,
        overlapMinutes: overlapMin,
      });
    }
  }
  return conflicts;
}

export function treatmentConflict(
  schedule: ScheduleLike,
  attendance: AttendanceLike,
  candidate: TreatmentRecord,
  coverages: TreatmentRecord[],
  treatments: TreatmentRecord[],
  isCoverage: boolean
): string | null {
  const conflicts = findConflictingTreatments(schedule, attendance, candidate, coverages, treatments, isCoverage);
  if (conflicts.length === 0) return null;
  const first = conflicts[0];
  const label = first.isCoverage ? "cobertura" : first.kind === "dispensa" ? "dispensa sem desconto" : "Sem cobertura, com desconto";
  return `Conflito com ${label} (${first.start_time.slice(0, 5)}–${first.end_time.slice(0, 5)}) da mesma ausência. Edite ou cancele/remova o tratamento anterior antes de salvar este período.`;
}

/** Fresh preflight returning conflicting records without throwing, allowing friendly replacement dialogs. */
export async function getTreatmentConflicts(
  schedule: ScheduleLike & { id: string; contract_id: string; post_id: string; work_date: string },
  attendance: AttendanceLike,
  candidate: TreatmentRecord,
  isCoverage: boolean
): Promise<{ conflicts: ConflictingRecordInfo[]; attendanceId?: string }> {
  const { data: a, error } = await supabase.from("attendance").select("id").eq("schedule_id", schedule.id).maybeSingle();
  if (error) throw error;
  const [c, t] = await Promise.all([
    supabase.from("coverages").select("*").eq("contract_id", schedule.contract_id).eq("post_id", schedule.post_id).eq("work_date", schedule.work_date),
    a ? supabase.from("absence_treatments").select("*").eq("attendance_id", a.id) : Promise.resolve({ data: [], error: null }),
  ]);
  if (c.error || t.error) throw c.error ?? t.error;
  const conflicts = findConflictingTreatments(
    schedule,
    attendance,
    candidate,
    (c.data ?? []).filter((r) => !r.attendance_id || r.attendance_id === a?.id),
    t.data ?? [],
    isCoverage
  );
  return { conflicts, attendanceId: a?.id };
}

/** Fresh preflight for both forms; throws if any conflict exists. */
export async function validateTreatmentConflict(
  schedule: ScheduleLike & { id: string; contract_id: string; post_id: string; work_date: string },
  attendance: AttendanceLike,
  candidate: TreatmentRecord,
  isCoverage: boolean
) {
  const { conflicts } = await getTreatmentConflicts(schedule, attendance, candidate, isCoverage);
  if (conflicts.length > 0) {
    const first = conflicts[0];
    const label = first.isCoverage ? "cobertura" : first.kind === "dispensa" ? "dispensa sem desconto" : "Sem cobertura, com desconto";
    throw new Error(`Conflito com ${label} (${first.start_time.slice(0, 5)}–${first.end_time.slice(0, 5)}) da mesma ausência. Edite ou cancele/remova o tratamento anterior antes de salvar este período.`);
  }
}

/** Inactivates or cancels conflicting treatments/coverages to enable seamless 1-click replacement. */
export async function replaceTreatmentConflicts(conflicts: ConflictingRecordInfo[]): Promise<void> {
  for (const c of conflicts) {
    if (!c.id) continue;
    if (c.isCoverage) {
      const { error } = await supabase.from("coverages").update({ status: "cancelada" }).eq("id", c.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("absence_treatments").update({ active: false }).eq("id", c.id);
      if (error) throw error;
    }
  }
}

/** Computes pending/uncovered intervals and suggests the first free time slot to prefill the form. */
export function suggestNextFreeInterval(
  schedule: ScheduleLike,
  attendance: AttendanceLike,
  coverages: TreatmentRecord[],
  treatments: TreatmentRecord[]
): {
  start: string;
  end: string;
  fullyCovered: boolean;
  pendingMinutes: number;
  pendingIntervals: Interval[];
  coveredIntervals: Interval[];
  waivedIntervals: Interval[];
  discountedIntervals: Interval[];
} {
  const need = needIntervals(schedule, attendance);
  const realized = coverages.filter((c) => c.status !== "cancelada");
  const covUnion = normalize(realized.flatMap((c) => workIntervals(c.start_time, c.end_time, c.break_start, c.break_end)));
  const covered = intersect(need, covUnion);
  const treatmentIntervals = (kind: string) =>
    treatments.filter((t) => t.active !== false && t.kind === kind).flatMap((t) => workIntervals(t.start_time, t.end_time));
  const waived = subtract(intersect(need, treatmentIntervals("dispensa")), covered);
  const uncovered = subtract(need, [...covered, ...waived]);
  const discounted = intersect(uncovered, treatmentIntervals("desconto"));
  const pending = subtract(uncovered, discounted);

  const hasAnyTreatment = covered.length > 0 || waived.length > 0 || discounted.length > 0;

  if (pending.length === 0) {
    return {
      start: schedule.start_time.slice(0, 5),
      end: schedule.end_time.slice(0, 5),
      fullyCovered: true,
      pendingMinutes: 0,
      pendingIntervals: [],
      coveredIntervals: covered,
      waivedIntervals: waived,
      discountedIntervals: discounted,
    };
  }

  // If no treatment has been made yet, suggest full shift as default
  if (!hasAnyTreatment) {
    return {
      start: schedule.start_time.slice(0, 5),
      end: schedule.end_time.slice(0, 5),
      fullyCovered: false,
      pendingMinutes: total(pending),
      pendingIntervals: pending,
      coveredIntervals: covered,
      waivedIntervals: waived,
      discountedIntervals: discounted,
    };
  }

  // Pre-fill with the first pending interval
  const first = pending[0];
  return {
    start: minToHHMM(first[0]),
    end: minToHHMM(first[1]),
    fullyCovered: false,
    pendingMinutes: total(pending),
    pendingIntervals: pending,
    coveredIntervals: covered,
    waivedIntervals: waived,
    discountedIntervals: discounted,
  };
}

/** Diagnoses legacy records in database that overlap each other on the same attendance/post/date. */
export function detectLegacyConflicts(
  schedule: ScheduleLike,
  attendance: AttendanceLike,
  coverages: TreatmentRecord[],
  treatments: TreatmentRecord[]
): LegacyConflictGroup[] {
  const need = needIntervals(schedule, attendance);
  const activeRecords: Array<{ r: TreatmentRecord; isCoverage: boolean; label: string; intervals: Interval[] }> = [];

  for (const c of coverages) {
    if (c.status === "cancelada") continue;
    const intervals = intersect(need, workIntervals(c.start_time, c.end_time, c.break_start, c.break_end));
    const label = c.coverer_type === "funcionario" ? "Cobertura por funcionário" : "Cobertura por diarista";
    activeRecords.push({
      r: c,
      isCoverage: true,
      label,
      intervals,
    });
  }

  for (const t of treatments) {
    if (t.active === false) continue;
    const intervals = intersect(need, workIntervals(t.start_time, t.end_time));
    const label = t.kind === "dispensa" ? "Dispensa sem desconto" : "Sem cobertura, com desconto";
    activeRecords.push({
      r: t,
      isCoverage: false,
      label,
      intervals,
    });
  }

  const result: LegacyConflictGroup[] = [];
  for (let i = 0; i < activeRecords.length; i++) {
    for (let j = i + 1; j < activeRecords.length; j++) {
      const rec1 = activeRecords[i];
      const rec2 = activeRecords[j];
      const overlap = intersect(rec1.intervals, rec2.intervals);
      const overlapMin = total(overlap);
      if (overlapMin > 0) {
        result.push({
          id1: rec1.r.id ?? "",
          id2: rec2.r.id ?? "",
          isCoverage1: rec1.isCoverage,
          isCoverage2: rec2.isCoverage,
          label1: rec1.label,
          label2: rec2.label,
          time1: `${rec1.r.start_time.slice(0, 5)}–${rec1.r.end_time.slice(0, 5)}`,
          time2: `${rec2.r.start_time.slice(0, 5)}–${rec2.r.end_time.slice(0, 5)}`,
          overlapMinutes: overlapMin,
        });
      }
    }
  }
  return result;
}