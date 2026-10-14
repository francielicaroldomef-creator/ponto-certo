export type ExportCol = { header: string; value: (r: any) => string | number }; // eslint-disable-line @typescript-eslint/no-explicit-any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportCSV(filename: string, cols: ExportCol[], rows: any[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => esc(c.header)).join(";"), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(";"))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportPDF(title: string, subtitle: string, cols: ExportCol[], rows: any[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(subtitle, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [cols.map((c) => c.header)],
    body: rows.map((r) => cols.map((c) => String(c.value(r)))),
    styles: { fontSize: 7 },
  });
  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}
