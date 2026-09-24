import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  filename: string;
  fetchData: () => Promise<Record<string, unknown>[]> | Record<string, unknown>[];
  sheetName?: string;
  compact?: boolean;
  label?: string;
}

function sanitizeSheetName(value: string): string {
  return value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Relatório";
}

function sanitizeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildWorkbook(rows: Record<string, unknown>[], sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  ws["!cols"] = headers.map((header) => {
    const max = Math.max(
      header.length,
      ...rows.slice(0, 5000).map((row) => String(row[header] ?? "").length),
    );
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  return wb;
}

export function ExportButton({
  filename,
  fetchData,
  sheetName = "Relatório",
  compact = false,
  label = "Exportar Excel",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await fetchData();
      if (!data?.length) return;
      const wb = buildWorkbook(data, sheetName);
      const safe = sanitizeFilename(filename) || "relatorio-gav";
      XLSX.writeFile(wb, `${safe}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Erro ao exportar Excel:", err);
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        title={loading ? "Exportando..." : label}
        aria-label={label}
        className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-50"
      >
        <Download className="size-3.5" />
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2"
    >
      <Download className="size-4" />
      {loading ? "Exportando..." : label}
    </Button>
  );
}
