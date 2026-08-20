import { CellDiff, SheetDiff, WorkbookDiff } from '../types';

export interface SheetData {
  name: string;
  rows: any[][];
  rowCount: number;
  colCount: number;
  truncated: boolean;
}

// A guard against a sheet with one cell parked at row 300000, which would build a
// grid that size. Anything clamped sets `truncated` so the UI can say so, because
// a cap that hides rows and still reports "no differences" is the worst outcome.
export const MAX_ROWS = 5000;
export const MAX_COLS = 200;

export function extractSheetData(workbookJson: any): SheetData[] {
  if (!workbookJson?.sheets) return [];

  const sheets: SheetData[] = [];

  for (const name of Object.keys(workbookJson.sheets)) {
    const sheetJson = workbookJson.sheets[name];
    const dataTable = sheetJson?.data?.dataTable;

    if (!dataTable) {
      sheets.push({ name, rows: [], rowCount: 0, colCount: 0, truncated: false });
      continue;
    }

    const rowKeys = Object.keys(dataTable).map(Number).sort((a, b) => a - b);
    if (rowKeys.length === 0) {
      sheets.push({ name, rows: [], rowCount: 0, colCount: 0, truncated: false });
      continue;
    }

    const lastRow = rowKeys[rowKeys.length - 1] + 1;
    const maxRow = Math.min(lastRow, MAX_ROWS);
    let maxCol = 0;

    for (const rk of rowKeys) {
      const rowData = dataTable[rk];
      if (rowData) {
        const colKeys = Object.keys(rowData).map(Number);
        for (const ck of colKeys) {
          if (ck > maxCol) maxCol = ck;
        }
      }
    }
    const lastCol = maxCol + 1;
    maxCol = Math.min(lastCol, MAX_COLS);

    const rows: any[][] = [];
    for (let r = 0; r < maxRow; r++) {
      const row: any[] = [];
      const rowData = dataTable[r];
      for (let c = 0; c < maxCol; c++) {
        const cell = rowData?.[c];
        row.push(cell?.value ?? null);
      }
      rows.push(row);
    }

    sheets.push({
      name,
      rows,
      rowCount: maxRow,
      colCount: maxCol,
      truncated: lastRow > MAX_ROWS || lastCol > MAX_COLS,
    });
  }

  return sheets;
}

function matchSheets(
  oldSheets: SheetData[],
  newSheets: SheetData[]
): { matched: [SheetData, SheetData][]; added: SheetData[]; removed: SheetData[] } {
  const oldNames = new Set(oldSheets.map((s) => s.name));
  const newNames = new Set(newSheets.map((s) => s.name));

  const matched: [SheetData, SheetData][] = [];
  const added: SheetData[] = [];
  const removed: SheetData[] = [];

  for (const newSheet of newSheets) {
    if (oldNames.has(newSheet.name)) {
      const oldSheet = oldSheets.find((s) => s.name === newSheet.name)!;
      matched.push([oldSheet, newSheet]);
    } else {
      added.push(newSheet);
    }
  }

  for (const oldSheet of oldSheets) {
    if (!newNames.has(oldSheet.name)) {
      removed.push(oldSheet);
    }
  }

  return { matched, added, removed };
}

function normalizeValue(val: any): any {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // Numbers are compared to the cent. Two figures that differ below that are
    // treated as the same figure.
    if (isNaN(val)) return null;
    return Math.round(val * 100) / 100;
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function valuesEqual(a: any, b: any): boolean {
  // Compared with ===, not String(a) === String(b). That made the number 5 equal
  // to the text "5", which is a change worth catching: the text cell stops
  // feeding the formulas that reference it. Both sides come out of
  // normalizeValue, so each is null, a number, or a string.
  return a === b;
}

function diffSheet(oldSheet: SheetData, newSheet: SheetData): CellDiff[] {
  const diffs: CellDiff[] = [];
  const maxRows = Math.max(oldSheet.rowCount, newSheet.rowCount);
  const maxCols = Math.max(oldSheet.colCount, newSheet.colCount);

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      const oldVal = normalizeValue(
        r < oldSheet.rowCount && c < oldSheet.colCount ? oldSheet.rows[r]?.[c] : null
      );
      const newVal = normalizeValue(
        r < newSheet.rowCount && c < newSheet.colCount ? newSheet.rows[r]?.[c] : null
      );

      if (valuesEqual(oldVal, newVal)) continue;

      let type: CellDiff['type'];
      if (oldVal === null) type = 'added';
      else if (newVal === null) type = 'removed';
      else type = 'changed';

      diffs.push({
        sheet: newSheet.name || oldSheet.name,
        row: r,
        col: c,
        oldValue: oldVal,
        newValue: newVal,
        type,
      });
    }
  }

  return diffs;
}

export function computeDiff(oldSheets: SheetData[], newSheets: SheetData[]): WorkbookDiff {
  const { matched, added, removed } = matchSheets(oldSheets, newSheets);

  const sheetDiffs: SheetDiff[] = [];

  for (const [oldSheet, newSheet] of matched) {
    const cellDiffs = diffSheet(oldSheet, newSheet);
    sheetDiffs.push({
      name: newSheet.name,
      status: cellDiffs.length > 0 ? 'modified' : 'unchanged',
      cellDiffs,
      summary: {
        changed: cellDiffs.filter((d) => d.type === 'changed').length,
        added: cellDiffs.filter((d) => d.type === 'added').length,
        removed: cellDiffs.filter((d) => d.type === 'removed').length,
      },
    });
  }

  for (const sheet of added) {
    const cellDiffs: CellDiff[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.colCount; c++) {
        const val = normalizeValue(sheet.rows[r]?.[c]);
        if (val !== null) {
          cellDiffs.push({
            sheet: sheet.name,
            row: r,
            col: c,
            oldValue: null,
            newValue: val,
            type: 'added',
          });
        }
      }
    }
    sheetDiffs.push({
      name: sheet.name,
      status: 'added',
      cellDiffs,
      summary: { changed: 0, added: cellDiffs.length, removed: 0 },
    });
  }

  for (const sheet of removed) {
    const cellDiffs: CellDiff[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      for (let c = 0; c < sheet.colCount; c++) {
        const val = normalizeValue(sheet.rows[r]?.[c]);
        if (val !== null) {
          cellDiffs.push({
            sheet: sheet.name,
            row: r,
            col: c,
            oldValue: val,
            newValue: null,
            type: 'removed',
          });
        }
      }
    }
    sheetDiffs.push({
      name: sheet.name,
      status: 'removed',
      cellDiffs,
      summary: { changed: 0, added: 0, removed: cellDiffs.length },
    });
  }

  const truncatedSheets = Array.from(
    new Set([...oldSheets, ...newSheets].filter((s) => s.truncated).map((s) => s.name))
  );

  return {
    sheets: sheetDiffs,
    summary: {
      truncatedSheets,
      sheetsAdded: added.length,
      sheetsRemoved: removed.length,
      sheetsModified: sheetDiffs.filter((s) => s.status === 'modified').length,
      sheetsUnchanged: sheetDiffs.filter((s) => s.status === 'unchanged').length,
      totalCellChanges: sheetDiffs.reduce(
        (sum, s) => sum + s.summary.changed + s.summary.added + s.summary.removed,
        0
      ),
    },
  };
}
