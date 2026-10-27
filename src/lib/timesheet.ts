// Client-side PDF timesheet extraction (text-based PDFs). Scanned PDFs return no text → manual review.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ExtractedPunch {
  page: number;
  registration: string | null;
  name: string | null;
  work_date: string; // YYYY-MM-DD
  marks: string[];
}

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pdfPagesText(buf: ArrayBuffer): Promise<string[][]> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    // group items into lines by y coordinate
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as any[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      byY.set(y, [...(byY.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    const lines = [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v.sort((a, b) => a.x - b.x).map((x) => x.s).join(" "));
    pages.push(lines);
  }
  return pages;
}

/** Parse lines: header "Matrícula: 1001  Nome: Fulano", rows "05/10/2026 07:00 11:00 12:00 16:00". */
export function parseTimesheet(pages: string[][], fallbackYear: number): ExtractedPunch[] {
  const out: ExtractedPunch[] = [];
  pages.forEach((lines, idx) => {
    let reg: string | null = null;
    let name: string | null = null;
    for (const line of lines) {
      const r = line.match(/matr[íi]cula\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
      if (r) reg = r[1] ?? null;
      const n = line.match(/(?:nome|funcion[áa]rio)\s*[:\-]\s*([A-Za-zÀ-ÿ0-9' ]{3,}?)(?=\s{2,}|\s+matr|\s+cargo|$)/i);
      if (n) name = n[1]?.trim() ?? null;
      const d = line.match(/\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/);
      if (!d) continue;
      const rest = line.slice((d.index ?? 0) + d[0].length);
      const marks = [...rest.matchAll(/\b([01]\d|2[0-3])[:h]([0-5]\d)\b/g)].map((m) => `${m[1]}:${m[2]}`);
      let y = d[3] ? Number(d[3]) : fallbackYear;
      if (y < 100) y += 2000;
      out.push({ page: idx + 1, registration: reg, name, work_date: `${y}-${d[2]}-${d[1]}`, marks });
    }
  });
  return out;
}
