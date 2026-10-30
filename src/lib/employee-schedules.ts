import { supabase } from "@/integrations/supabase/client";

export interface DaySchedule {
  dayOfWeek: number; // 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado, 7 = Domingo (ISO 8601)
  dayLabel: string;
  dayShort: string;
  enabled: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
  hasBreak: boolean;
  breakStart: string;// "12:00"
  breakEnd: string;  // "13:00"
}

export const DAYS_OF_WEEK_TEMPLATE: ReadonlyArray<Omit<DaySchedule, "enabled" | "startTime" | "endTime" | "hasBreak" | "breakStart" | "breakEnd">> = [
  { dayOfWeek: 1, dayLabel: "Segunda-feira", dayShort: "Seg" },
  { dayOfWeek: 2, dayLabel: "Terça-feira", dayShort: "Ter" },
  { dayOfWeek: 3, dayLabel: "Quarta-feira", dayShort: "Qua" },
  { dayOfWeek: 4, dayLabel: "Quinta-feira", dayShort: "Qui" },
  { dayOfWeek: 5, dayLabel: "Sexta-feira", dayShort: "Sex" },
  { dayOfWeek: 6, dayLabel: "Sábado", dayShort: "Sáb" },
  { dayOfWeek: 7, dayLabel: "Domingo", dayShort: "Dom" },
];

export function createDefaultSchedule(): DaySchedule[] {
  return DAYS_OF_WEEK_TEMPLATE.map((d) => {
    const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
    return {
      ...d,
      enabled: isWeekday,
      startTime: "08:00",
      endTime: "17:00",
      hasBreak: true,
      breakStart: "12:00",
      breakEnd: "13:00",
    };
  });
}

/** Check if shift starts on one day and finishes on the next (crosses midnight) */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);
  return endMin < startMin;
}

/** Total working minutes in a shift excluding interval */
export function calculateShiftMinutes(sched: Pick<DaySchedule, "enabled" | "startTime" | "endTime" | "hasBreak" | "breakStart" | "breakEnd">): number {
  if (!sched.enabled || !sched.startTime || !sched.endTime) return 0;
  const [sh, sm] = sched.startTime.split(":").map(Number);
  const [eh, em] = sched.endTime.split(":").map(Number);
  const startMin = (sh ?? 0) * 60 + (sm ?? 0);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);

  let shiftMin = endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin;

  if (sched.hasBreak && sched.breakStart && sched.breakEnd) {
    const [bsh, bsm] = sched.breakStart.split(":").map(Number);
    const [beh, bem] = sched.breakEnd.split(":").map(Number);
    const bsMin = (bsh ?? 0) * 60 + (bsm ?? 0);
    const beMin = (beh ?? 0) * 60 + (bem ?? 0);
    const breakMin = beMin >= bsMin ? beMin - bsMin : 1440 - bsMin + beMin;
    shiftMin = Math.max(0, shiftMin - breakMin);
  }

  return shiftMin;
}

export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : "00"}`;
}

/** Concise human-readable summary of the weekly schedule */
export function formatScheduleSummary(schedule: DaySchedule[]): string {
  if (!schedule || schedule.length === 0) return "Sem horário definido";

  const activeDays = schedule.filter((d) => d.enabled);
  if (activeDays.length === 0) return "Sem escala ativa";

  const first = activeDays[0];
  const allSameHours = activeDays.every(
    (d) =>
      d.startTime === first.startTime &&
      d.endTime === first.endTime &&
      d.hasBreak === first.hasBreak &&
      d.breakStart === first.breakStart &&
      d.breakEnd === first.breakEnd
  );

  const overnightTag = isOvernightShift(first.startTime, first.endTime) ? " (+1d)" : "";

  // Check if standard Mon–Fri
  const activeNums = activeDays.map((d) => d.dayOfWeek).sort((a, b) => a - b);
  const isMonToFri = activeNums.length === 5 && activeNums.every((n, i) => n === i + 1);
  const isMonToSat = activeNums.length === 6 && activeNums.every((n, i) => n === i + 1);

  let dayRange = "";
  if (isMonToFri) {
    dayRange = "Seg–Sex";
  } else if (isMonToSat) {
    dayRange = "Seg–Sáb";
  } else if (activeDays.length === 7) {
    dayRange = "Todos os dias";
  } else {
    dayRange = activeDays.map((d) => d.dayShort).join(", ");
  }

  if (allSameHours) {
    return `${dayRange} ${first.startTime.slice(0, 5)}–${first.endTime.slice(0, 5)}${overnightTag}`;
  }

  return `${dayRange} (horários variáveis)`;
}

const STORAGE_PREFIX = "employee_work_schedule_";

/** Load employee schedule pattern: first localStorage, then deduce from DB schedules, then fallback */
export function loadEmployeeSchedule(employeeId: string, existingDbSchedules?: any[]): DaySchedule[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${employeeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 7) {
          return parsed;
        }
      }
    } catch (_) {}
  }

  // Deduce from existing DB schedules if available
  if (existingDbSchedules && existingDbSchedules.length > 0) {
    const template = createDefaultSchedule();
    // Reset all to disabled initially
    template.forEach((d) => (d.enabled = false));

    for (const s of existingDbSchedules) {
      if (!s.work_date || !s.start_time) continue;
      const dateObj = new Date(s.work_date + "T12:00:00Z");
      // ISO dow: 1=Mon, ..., 7=Sun
      const jsDay = dateObj.getUTCDay();
      const isoDow = jsDay === 0 ? 7 : jsDay;

      const target = template.find((t) => t.dayOfWeek === isoDow);
      if (target) {
        target.enabled = true;
        target.startTime = s.start_time.slice(0, 5);
        target.endTime = (s.end_time || "17:00").slice(0, 5);
        if (s.break_start && s.break_end) {
          target.hasBreak = true;
          target.breakStart = s.break_start.slice(0, 5);
          target.breakEnd = s.break_end.slice(0, 5);
        } else {
          target.hasBreak = false;
        }
      }
    }

    // If at least one day was found, cache and return
    if (template.some((t) => t.enabled)) {
      saveEmployeeSchedule(employeeId, template);
      return template;
    }
  }

  return createDefaultSchedule();
}

/** Save schedule pattern to localStorage */
export function saveEmployeeSchedule(employeeId: string, schedule: DaySchedule[]): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${employeeId}`, JSON.stringify(schedule));
    } catch (_) {}
  }
}

/**
 * Synchronize employee weekly schedule into `schedules` table for a date range (default: 45 days forward from today).
 * Preserves past records and ensures attendance/divergences/conferencia use the exact configured hours.
 */
export async function syncEmployeeSchedulesToDb(
  employeeId: string,
  contractId: string,
  postId: string,
  schedule: DaySchedule[],
  startDateStr?: string,
  daysCount = 45
): Promise<{ inserted: number }> {
  if (!employeeId || !contractId || !postId) return { inserted: 0 };

  const start = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  const rowsToUpsert: any[] = [];

  for (let i = 0; i < daysCount; i++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + i);

    const jsDay = curDate.getDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    const dayConfig = schedule.find((s) => s.dayOfWeek === isoDow);

    if (dayConfig && dayConfig.enabled && dayConfig.startTime && dayConfig.endTime) {
      const year = curDate.getFullYear();
      const month = String(curDate.getMonth() + 1).padStart(2, "0");
      const day = String(curDate.getDate()).padStart(2, "0");
      const workDate = `${year}-${month}-${day}`;

      rowsToUpsert.push({
        employee_id: employeeId,
        contract_id: contractId,
        post_id: postId,
        work_date: workDate,
        start_time: dayConfig.startTime.slice(0, 5),
        end_time: dayConfig.endTime.slice(0, 5),
        break_start: dayConfig.hasBreak && dayConfig.breakStart ? dayConfig.breakStart.slice(0, 5) : null,
        break_end: dayConfig.hasBreak && dayConfig.breakEnd ? dayConfig.breakEnd.slice(0, 5) : null,
      });
    }
  }

  if (rowsToUpsert.length === 0) return { inserted: 0 };

  try {
    const { data, error } = await supabase
      .from("schedules")
      .upsert(rowsToUpsert, { onConflict: "employee_id,work_date,start_time", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.warn("[syncEmployeeSchedulesToDb] Aviso ao sincronizar escalas:", error.message);
      return { inserted: 0 };
    }

    return { inserted: data?.length ?? rowsToUpsert.length };
  } catch (err) {
    console.warn("[syncEmployeeSchedulesToDb] Erro ao sincronizar:", err);
    return { inserted: 0 };
  }
}
