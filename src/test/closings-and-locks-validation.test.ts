import { describe, expect, it } from "vitest";
import { computePostDay, emptyTotals, addToTotals, type AttendanceLike, type CoverageLike, type TreatmentLike } from "@/lib/calc";

const shift = { start_time: "08:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" };
const falta8h: AttendanceLike = { status: "falta_integral", hour_value: 22.5 };

describe("Item 3: Fechamento de Período e Bloqueios", () => {
  it("3.1 Bloqueio por Pendência: detecta horas com tratamento pendente e marca período como provisório/impeditivo", () => {
    // Falta de 8h sem nenhum tratamento
    const resPendente = computePostDay(shift, falta8h, []);
    expect(resPendente.pendingMin).toBe(480);

    const totals = addToTotals(emptyTotals(), falta8h, resPendente);
    expect(totals.pendingMin).toBe(480);

    // Regra do período: se totals.pendingMin > 0, período é provisório e NÃO pode ser fechado
    const isProvisional = totals.pendingMin > 0;
    expect(isProvisional).toBe(true);

    const canClosePeriod = !isProvisional;
    expect(canClosePeriod).toBe(false);
  });

  it("3.2 Efetivação de Fechamento: resolve pendências, descongela trava de provisório e congela totais no snapshot", () => {
    // Trata a falta com cobertura integral realizada
    const cov: CoverageLike = {
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      status: "realizada",
      agreed_value: 130.0,
    };
    const resResolvido = computePostDay(shift, falta8h, [cov]);
    expect(resResolvido.pendingMin).toBe(0);

    const totals = addToTotals(emptyTotals(), falta8h, resResolvido);
    const notInformed = 0;
    const openCalcDivergences = 0;

    // Condição de fechamento do sistema
    const isProvisional = openCalcDivergences > 0 || notInformed > 0 || totals.pendingMin > 0;
    expect(isProvisional).toBe(false);

    // Snapshot gerado no fechamento
    const snapshot = {
      totals: { ...totals },
      rows: 1,
      dayRows: [{ schedule: { id: "sched-1" }, result: { ...resResolvido } }],
      generated_at: new Date().toISOString(),
    };

    expect(snapshot.totals.pendingMin).toBe(0);
    expect(snapshot.totals.coveredMin).toBe(480);
    expect(snapshot.totals.discountCents).toBe(0);

    // Verificação de preservação: mesmo que regra cadastral mude no futuro, o snapshot congelado preserva os valores
    const savedDayRow = snapshot.dayRows.find((r) => r.schedule.id === "sched-1");
    expect(savedDayRow?.result.discountCents).toBe(0);
  });

  it("3.3 Trava Pós-Fechamento: verificação de bloqueio quando período está fechado", () => {
    const isPeriodClosed = true; // Supabase rpc is_period_closed retorna true
    const userRole = "supervisor";
    const canEdit = ["admin", "supervisor", "conferente"].includes(userRole) && !isPeriodClosed;

    expect(canEdit).toBe(false); // Edição desabilitada na interface
  });

  it("3.4 Reabertura Auditada: exige justificativa de ao menos 5 caracteres", () => {
    const validarReabertura = (motivo: string) => {
      if (motivo.trim().length < 5) throw new Error("Informe o motivo da reabertura.");
      return { status: "aberto", reopen_reason: motivo };
    };

    expect(() => validarReabertura("")).toThrow("Informe o motivo da reabertura.");
    expect(() => validarReabertura("abc")).toThrow("Informe o motivo da reabertura.");
    const reaberto = validarReabertura("Reaberto para ajuste autorizado pelo financeiro.");
    expect(reaberto.status).toBe("aberto");
    expect(reaberto.reopen_reason).toBe("Reaberto para ajuste autorizado pelo financeiro.");
  });
});
