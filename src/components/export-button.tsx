import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  filename: string;
  fetchData: () => Promise<Record<string, unknown>[]>;
}

function toCSV(rows: Record<string, unknown>[]): string {
  const firstRow = rows[0];
  if (!firstRow) return "";
  const headers = Object.keys(firstRow);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return "\uFEFF" + lines.join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ filename, fetchData }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await fetchData();
      const csv = toCSV(data);
      downloadCSV(csv, filename);
    } catch (err) {
      console.error("Erro ao exportar:", err);
    } finally {
      setLoading(false);
    }
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
      {loading ? "Exportando..." : "Exportar CSV"}
    </Button>
  );
}
