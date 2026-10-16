import { describe, expect, it } from "vitest";
import { parseTimesheet } from "@/lib/timesheet";

describe("Leitura do cartão de ponto", () => {
  it("extrai matrícula, data e 4 marcações", () => {
    const r = parseTimesheet([["Matrícula: 1001  Nome: Ana Souza", "05/10/2026 07:00 11:00 12:00 16:00"]], 2026);
    expect(r).toEqual([{ page: 1, registration: "1001", name: "Ana Souza", work_date: "2026-10-05", marks: ["07:00", "11:00", "12:00", "16:00"] }]);
  });
  it("detecta número ímpar de marcações", () => {
    const r = parseTimesheet([["Matrícula: 1002", "06/10 07:00 11:00 12:00"]], 2026);
    expect(r[0]!.work_date).toBe("2026-10-06");
    expect(r[0]!.marks.length % 2).toBe(1);
  });
  it("dia sem marcações retorna lista vazia", () => {
    const r = parseTimesheet([["Matrícula: 1003", "07/10/2026 FALTA"]], 2026);
    expect(r[0]!.marks).toEqual([]);
  });
});
