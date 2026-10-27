import React from "react";
import {
  intersect,
  minToHHMM,
  needIntervals,
  normalize,
  subtract,
  total,
  workIntervals,
  type AttendanceLike,
  type ScheduleLike,
  type Interval,
} from "@/lib/calc";
import { hours } from "@/lib/format";
import type { TreatmentRecord } from "@/lib/treatment-conflicts";

export interface ShiftTimelineProps {
  schedule: ScheduleLike;
  attendance: AttendanceLike | null | undefined;
  coverages: TreatmentRecord[];
  treatments: TreatmentRecord[];
  className?: string;
}

function fmtIntervals(intervals: Interval[]): string {
  return intervals.map(([a, b]) => `${minToHHMM(a)}–${minToHHMM(b)}`).join(", ");
}

export function ShiftTimeline({
  schedule,
  attendance,
  coverages,
  treatments,
  className = "",
}: ShiftTimelineProps) {
  const work = workIntervals(schedule.start_time, schedule.end_time, schedule.break_start, schedule.break_end);
  const workMin = total(work);
  if (workMin <= 0) return null;

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

  const coveredMin = total(covered);
  const waivedMin = total(waived);
  const discountedMin = total(discounted);
  const pendingMin = total(pending);
  const needMin = total(need);
  const attendedMin = Math.max(0, workMin - needMin);

  const coveredPct = (coveredMin / workMin) * 100;
  const waivedPct = (waivedMin / workMin) * 100;
  const discountedPct = (discountedMin / workMin) * 100;
  const pendingPct = (pendingMin / workMin) * 100;
  const attendedPct = (attendedMin / workMin) * 100;

  return (
    <div className={`space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          Linha do tempo da jornada: {hours(workMin)} ({schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}
          {schedule.break_start ? `, int. ${schedule.break_start.slice(0, 5)}–${schedule.break_end?.slice(0, 5)}` : ""})
        </span>
        <span className={pendingMin > 0 ? "font-semibold text-destructive" : "font-medium text-emerald-600 dark:text-emerald-400"}>
          {pendingMin > 0 ? `${hours(pendingMin)} pendente(s)` : "100% contemplada"}
        </span>
      </div>

      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full border border-border/50 bg-muted/60"
        role="progressbar"
        aria-label="Progresso da cobertura da jornada"
        aria-valuenow={Math.round(100 - pendingPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {attendedPct > 0 && (
          <div
            style={{ width: `${attendedPct}%` }}
            className="h-full bg-muted-foreground/30 transition-all"
            title={`Trabalhado: ${hours(attendedMin)}`}
          />
        )}
        {coveredPct > 0 && (
          <div
            style={{ width: `${coveredPct}%` }}
            className="h-full bg-emerald-500 transition-all"
            title={`Cobertura: ${hours(coveredMin)} (${fmtIntervals(covered)})`}
          />
        )}
        {waivedPct > 0 && (
          <div
            style={{ width: `${waivedPct}%` }}
            className="h-full bg-sky-500 transition-all"
            title={`Dispensa tomador: ${hours(waivedMin)} (${fmtIntervals(waived)})`}
          />
        )}
        {discountedPct > 0 && (
          <div
            style={{ width: `${discountedPct}%` }}
            className="h-full bg-amber-500 transition-all"
            title={`Desconto cliente: ${hours(discountedMin)} (${fmtIntervals(discounted)})`}
          />
        )}
        {pendingPct > 0 && (
          <div
            style={{ width: `${pendingPct}%` }}
            className="h-full bg-rose-500/80 transition-all"
            title={`Pendente: ${hours(pendingMin)} (${fmtIntervals(pending)})`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {attendedMin > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Trabalhado: {hours(attendedMin)}
          </span>
        )}
        {coveredMin > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Coberto: {hours(coveredMin)} {covered.length ? `(${fmtIntervals(covered)})` : ""}
          </span>
        )}
        {waivedMin > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Dispensado: {hours(waivedMin)} {waived.length ? `(${fmtIntervals(waived)})` : ""}
          </span>
        )}
        {discountedMin > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Desconto: {hours(discountedMin)} {discounted.length ? `(${fmtIntervals(discounted)})` : ""}
          </span>
        )}
        {pendingMin > 0 ? (
          <span className="flex items-center gap-1 font-medium text-destructive">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Faltam tratar: {hours(pendingMin)} ({fmtIntervals(pending)})
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Jornada 100% tratada
          </span>
        )}
      </div>
    </div>
  );
}
