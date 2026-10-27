import { describe, expect, it } from "vitest";
import { sanitizeFinancialData } from "@/lib/data";
import type { PeriodData } from "@/lib/data";
import * as fs from "fs";
import * as path from "path";

describe("🛡️ PROTOCOLO DE SEGURANÇA MÁXIMA ZERO-TRUST (PORTAL DO SUPERVISOR)", () => {
  const mockPeriodData: PeriodData = {
    totals: {
      scheduledMin: 9600,
      workedMin: 8640,
      absentMin: 960,
      coveredMin: 480,
      waivedMin: 0,
      pendingMin: 0,
      uncoveredMin: 480,
      discountCents: 18000,
      coverageCostCents: 13000,
      impactCents: 31000,
    },
    rows: [
      {
        schedule: {
          id: "sch-01",
          contract_id: "ct-01",
          post_id: "post-01",
          employee_id: "emp-01",
          work_date: "2026-10-01",
          start_time: "08:00",
          end_time: "17:00",
          break_start: "12:00",
          break_end: "13:00",
        },
        post: {
          id: "post-01",
          contract_id: "ct-01",
          code: "P-01",
          role_name: "Porteiro",
          shift: "Diurno",
          hour_value: 22.5,
          day_value: 180.0,
          required_qty: 1,
          start_time: "08:00",
          end_time: "17:00",
          break_start: "12:00",
          break_end: "13:00",
          active: true,
          valid_from: null,
          valid_to: null,
          is_demo: false,
          created_at: "2026-10-01",
        },
        employee: {
          id: "emp-01",
          contract_id: "ct-01",
          registration: "MAT-01",
          name: "João Silva",
          cpf: "123.456.789-00",
          role_name: "Porteiro",
          status: "ativo",
          created_at: "2026-10-01",
        },
        attendance: {
          id: "att-01",
          schedule_id: "sch-01",
          work_date: "2026-10-01",
          status: "falta_integral",
          entry_time: null,
          exit_time: null,
          break_start: null,
          break_end: null,
          hour_value: 22.5,
          created_at: "2026-10-01",
          notes: null,
        },
        coverages: [
          {
            id: "cov-01",
            contract_id: "ct-01",
            post_id: "post-01",
            attendance_id: "att-01",
            work_date: "2026-10-01",
            start_time: "08:00",
            end_time: "17:00",
            break_start: "12:00",
            break_end: "13:00",
            coverer_type: "diarista",
            agreed_value: 130.0,
            status: "realizada",
            payment_status: "pendente",
            day_worker_id: "dw-01",
            employee_id: null,
            supervisor_id: null,
            created_at: "2026-10-01",
          },
        ],
        treatments: [],
        result: {
          scheduledIntervals: [[480, 1020]],
          workedIntervals: [],
          absentIntervals: [[480, 1020]],
          coveredIntervals: [[480, 1020]],
          waivedIntervals: [],
          pendingIntervals: [],
          uncoveredIntervals: [],
          requiredMin: 480,
          workedMin: 0,
          absentMin: 480,
          coveredMin: 480,
          waivedMin: 0,
          pendingMin: 0,
          uncoveredMin: 0,
          needMin: 480,
          discountCents: 0,
          coverageCostCents: 13000,
        },
        unitCentsPerMin: 37.5,
      },
    ],
    coverages: [
      {
        id: "cov-01",
        contract_id: "ct-01",
        post_id: "post-01",
        attendance_id: "att-01",
        work_date: "2026-10-01",
        start_time: "08:00",
        end_time: "17:00",
        break_start: "12:00",
        break_end: "13:00",
        coverer_type: "diarista",
        agreed_value: 130.0,
        status: "realizada",
        payment_status: "pendente",
        day_worker_id: "dw-01",
        employee_id: null,
        supervisor_id: null,
        created_at: "2026-10-01",
      },
    ],
    treatments: [],
    notInformed: 0,
    openCalcDivergences: 0,
    provisional: false,
    closing: null,
  };

  it("1. Sanitização Financeira Zero-Trust: Usuário supervisor (não-financeiro) não recebe valores monetários", () => {
    const sanitized = sanitizeFinancialData(mockPeriodData, false);

    // Totais financeiros zerados no payload
    expect(sanitized.totals.discountCents).toBe(0);
    expect(sanitized.totals.coverageCostCents).toBe(0);
    expect(sanitized.totals.impactCents).toBe(0);

    // Linha de presença: valores horários e diários expurgados
    const row = sanitized.rows[0];
    expect(row.post?.hour_value).toBeNull();
    expect(row.post?.day_value).toBeNull();
    expect(row.attendance?.hour_value).toBeNull();
    expect(row.unitCentsPerMin).toBe(0);
    expect(row.result.discountCents).toBe(0);
    expect(row.result.coverageCostCents).toBe(0);

    // Coberturas: valor combinado (diária) sanitizado
    expect(row.coverages[0].agreed_value).toBeNull();
    expect(sanitized.coverages[0].agreed_value).toBeNull();
  });

  it("2. Preservação de Valores para Perfis Autorizados (Admin / Financeiro)", () => {
    const authorized = sanitizeFinancialData(mockPeriodData, true);

    expect(authorized.totals.discountCents).toBe(18000);
    expect(authorized.totals.coverageCostCents).toBe(13000);
    expect(authorized.totals.impactCents).toBe(31000);

    const row = authorized.rows[0];
    expect(row.post?.hour_value).toBe(22.5);
    expect(row.post?.day_value).toBe(180.0);
    expect(row.attendance?.hour_value).toBe(22.5);
    expect(row.unitCentsPerMin).toBe(37.5);
    expect(row.coverages[0].agreed_value).toBe(130.0);
    expect(authorized.coverages[0].agreed_value).toBe(130.0);
  });

  it("3. Anti-Inspecionar: vite.config.ts possui sourcemap desativado em produção", () => {
    const viteConfigPath = path.resolve(__dirname, "../../vite.config.ts");
    const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");

    expect(viteConfigContent).toContain("sourcemap: false");
    expect(viteConfigContent).toContain('drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : []');
  });

  it("4. Sigilo de Credenciais: Ausência total de SUPABASE_SERVICE_ROLE_KEY no bundle cliente", () => {
    const clientPath = path.resolve(__dirname, "../integrations/supabase/client.ts");
    const clientContent = fs.readFileSync(clientPath, "utf-8");

    // Client nunca importa nem utiliza service_role
    expect(clientContent).not.toContain("SERVICE_ROLE");
    expect(clientContent).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("5. Proteção de Arquivos de Ponto: Signed URLs com TTL <= 60s e sem URLs públicas", () => {
    const docsPath = path.resolve(__dirname, "../routes/_authenticated/documentos.tsx");
    const docsContent = fs.readFileSync(docsPath, "utf-8");

    // TTL de 60 segundos obrigatório
    expect(docsContent).toContain('createSignedUrl(d.file_path, 60)');
    // Sem exposição via getPublicUrl
    expect(docsContent).not.toContain("getPublicUrl");
  });
});
