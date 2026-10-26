import { supabase } from "@/integrations/supabase/client";
import { intersect, needIntervals, total, workIntervals, type AttendanceLike, type ScheduleLike } from "./calc";

export interface TreatmentRecord {
  id?: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  status?: string;
  kind?: string;
  active?: boolean;
}

export function treatmentConflict(schedule: ScheduleLike, attendance: AttendanceLike, candidate: TreatmentRecord, coverages: TreatmentRecord[], treatments: TreatmentRecord[], isCoverage: boolean): string | null {
  if ((isCoverage && candidate.status === "cancelada") || (!isCoverage && candidate.active === false)) return null;
  const need = needIntervals(schedule, attendance);
  const intervals = (r: TreatmentRecord, coverage: boolean) => intersect(need, workIntervals(r.start_time, r.end_time, coverage ? r.break_start : null, coverage ? r.break_end : null));
  const proposed = intervals(candidate, isCoverage);
  for (const [records, coverage] of [[coverages, true], [treatments, false]] as const) {
    for (const r of records) {
      if (coverage ? r.status === "cancelada" : r.active === false) continue;
      if (coverage === isCoverage && candidate.id && r.id === candidate.id) continue;
      if (total(intersect(proposed, intervals(r, coverage))) === 0) continue;
      const label = coverage ? "cobertura" : r.kind === "dispensa" ? "dispensa sem desconto" : "Sem cobertura, com desconto";
      return `Conflito com ${label} (${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}) da mesma ausência. Edite ou cancele/remova o tratamento anterior antes de salvar este período.`;
    }
  }
  return null;
}

/** Fresh preflight for both forms; database triggers remain the authoritative write guard. */
export async function validateTreatmentConflict(schedule: ScheduleLike & { id: string; contract_id: string; post_id: string; work_date: string }, attendance: AttendanceLike, candidate: TreatmentRecord, isCoverage: boolean) {
  const { data: a, error } = await supabase.from("attendance").select("id").eq("schedule_id", schedule.id).maybeSingle();
  if (error) throw error;
  const [c, t] = await Promise.all([
    supabase.from("coverages").select("*").eq("contract_id", schedule.contract_id).eq("post_id", schedule.post_id).eq("work_date", schedule.work_date),
    a ? supabase.from("absence_treatments").select("*").eq("attendance_id", a.id) : Promise.resolve({ data: [], error: null }),
  ]);
  if (c.error || t.error) throw c.error ?? t.error;
  const message = treatmentConflict(schedule, attendance, candidate, (c.data ?? []).filter(r => !r.attendance_id || r.attendance_id === a?.id), t.data ?? [], isCoverage);
  if (message) throw new Error(message);
}