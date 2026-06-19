import { PdfCheck, PdfCheckResult, WorkbookRef } from '../types';

function cellToColRow(cell: string): { col: number; row: number } | null {
  const match = cell.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  const colStr = match[1].toUpperCase();
  const row = parseInt(match[2], 10) - 1;

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1;

  return { col, row };
}

export function getCellValueFromJson(workbookJson: any, ref: WorkbookRef): number | null {
  if (!workbookJson || !workbookJson.sheets) return null;

  // Try exact match first, then fuzzy match (handles trailing spaces, etc.)
  let sheetJson = workbookJson.sheets[ref.sheet];
  if (!sheetJson) {
    const sheetKey = Object.keys(workbookJson.sheets).find(
      (k) => k.trim() === ref.sheet.trim()
    );
    if (sheetKey) sheetJson = workbookJson.sheets[sheetKey];
  }
  if (!sheetJson) return null;

  const pos = cellToColRow(ref.cell);
  if (!pos) return null;

  const { row, col } = pos;

  // Handle different possible JSON structures from ExcelIO
  const dataTable = sheetJson.data?.dataTable;
  if (!dataTable) return null;

  // dataTable keys might be numeric or string
  const rowData = dataTable[row] || dataTable[String(row)];
  if (!rowData) return null;

  const cellData = rowData[col] || rowData[String(col)];
  if (!cellData) return null;

  // Value might be in .value or directly
  const val = cellData.value !== undefined ? cellData.value : cellData;
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/[,$]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

export function runChecks(workbookJson: any, checks: PdfCheck[]): PdfCheckResult[] {
  return checks.map((check) => {
    const actualValues = check.workbookRefs.map((ref) => ({
      ref,
      value: getCellValueFromJson(workbookJson, ref),
    }));

    const tolerance = check.tolerance ?? 1;
    let allPass = true;
    const messages: string[] = [];

    for (const { ref, value } of actualValues) {
      if (value === null) {
        allPass = false;
        messages.push(`${ref.sheet}!${ref.cell}: value not found`);
        continue;
      }

      const diff = Math.abs(value - check.pdfValue);
      const diffFlipped = check.allowSignFlip
        ? Math.abs(value + check.pdfValue)
        : Infinity;

      if (diff <= tolerance || diffFlipped <= tolerance) {
        messages.push(
          `${ref.sheet}!${ref.cell}: ${value.toLocaleString()} ✓ matches PDF (${check.pdfValue.toLocaleString()})`
        );
      } else {
        allPass = false;
        messages.push(
          `${ref.sheet}!${ref.cell}: ${value.toLocaleString()} ✗ expected ${check.pdfValue.toLocaleString()} (diff: ${diff.toLocaleString()})`
        );
      }
    }

    return {
      check,
      status: allPass ? 'pass' : 'fail',
      actualValues,
      message: messages.join('\n'),
    };
  });
}
