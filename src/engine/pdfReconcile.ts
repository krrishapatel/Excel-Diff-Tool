import { PdfCheck, PdfCheckResult, WorkbookRef } from '../types';

export function getCellValue(workbook: any, ref: WorkbookRef): number | null {
  const sheetCount = workbook.getSheetCount();
  let sheet = null;

  for (let i = 0; i < sheetCount; i++) {
    const s = workbook.getSheet(i);
    if (s.name() === ref.sheet) {
      sheet = s;
      break;
    }
  }

  if (!sheet) return null;

  const match = ref.cell.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  const colStr = match[1].toUpperCase();
  const row = parseInt(match[2], 10) - 1;

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1;

  const val = sheet.getValue(row, col);
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/[,$]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

export function runChecks(workbook: any, checks: PdfCheck[]): PdfCheckResult[] {
  return checks.map((check) => {
    const actualValues = check.workbookRefs.map((ref) => ({
      ref,
      value: getCellValue(workbook, ref),
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
          `${ref.sheet}!${ref.cell}: ${value} ✓ matches PDF (${check.pdfValue})`
        );
      } else {
        allPass = false;
        messages.push(
          `${ref.sheet}!${ref.cell}: ${value} ✗ expected ${check.pdfValue} (diff: ${diff})`
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
