"use client";

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

export function buildCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => escapeCsvValue(typeof column.value === "function" ? column.value(row) : row[column.value]))
        .join(","),
    )
    .join("\n");

  return `\uFEFF${header}\n${body}`;
}

export function downloadCsv(filename, rows, columns) {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
