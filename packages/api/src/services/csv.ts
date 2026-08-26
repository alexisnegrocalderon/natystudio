/**
 * CSV pensado para abrirse en Excel en español: BOM UTF-8 (si no, tilda y ñ
 * salen mal) y `;` como separador (Excel en configuración regional español
 * usa la coma como separador decimal, así que interpreta `,` como parte del
 * número en vez de como separador de columnas).
 */
const SEPARATOR = ";";
const BOM = "﻿";

function escapeField(value: string): string {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map(fields => fields.map(escapeField).join(SEPARATOR));
  return BOM + lines.join("\r\n") + "\r\n";
}
