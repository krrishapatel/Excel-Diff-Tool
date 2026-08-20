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
  const rowData = dataTable[row] ?? dataTable[String(row)];
  if (rowData === null || rowData === undefined) return null;

  const cellData = rowData[col] ?? rowData[String(col)];
  // Checked against null and undefined, not for truthiness. A cell holding a bare
  // 0 failed `if (!cellData)` and came back as "value not found". A balance of 0
  // is a normal balance.
  if (cellData === null || cellData === undefined) return null;

  // Value might be in .value or directly
  const val = cellData.value !== undefined ? cellData.value : cellData;
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  return parseNumeric(String(val));
}

// Accounting exports write negatives in parentheses: (1,234) and $(1,234.00).
// parseFloat gives NaN for both, and the caller reports NaN as "value not found",
// so a retained earnings line that is negative by nature never reconciled.
function parseNumeric(raw: string): number | null {
  const text = raw.trim();
  const negated = /^\((.*)\)$/.test(text.replace(/^[$\s]+/, ''));
  const digits = text.replace(/[(),$\s]/g, '');
  if (digits === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(digits)) return null;

  const parsed = parseFloat(digits);
  if (isNaN(parsed)) return null;
  return negated ? -Math.abs(parsed) : parsed;
}

export function runChecks(workbookJson: any, checks: PdfCheck[]): PdfCheckResult[] {
  return checks.map((check) => {
    const actualValues = check.workbookRefs.map((ref) => ({
      ref,
      value: getCellValueFromJson(workbookJson, ref),
    }));

    // allPass starts true and the loop below never runs, so a check with no refs
    // used to report a green tick against a figure it never looked for.
    if (actualValues.length === 0) {
      return {
        check,
        status: 'warning',
        actualValues,
        message: 'This check lists no workbook cells to compare against the PDF.',
      };
    }

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
