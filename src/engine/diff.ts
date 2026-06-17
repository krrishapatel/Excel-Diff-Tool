import { CellDiff, SheetDiff, WorkbookDiff } from '../types';

interface SheetData {
  name: string;
  rows: any[][];
  rowCount: number;
  colCount: number;
}

export function extractSheetData(workbook: any): SheetData[] {
  const sheets: SheetData[] = [];
  const sheetCount = workbook.getSheetCount();

  for (let i = 0; i < sheetCount; i++) {
    const sheet = workbook.getSheet(i);
    const name = sheet.name();
    const rowCount = sheet.getRowCount();
    const colCount = sheet.getColumnCount();
    const rows: any[][] = [];

    for (let r = 0; r < rowCount; r++) {
      const row: any[] = [];
      for (let c = 0; c < colCount; c++) {
        row.push(sheet.getValue(r, c));
      }
      rows.push(row);
    }

    sheets.push({ name, rows, rowCount, colCount });
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
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  return val;
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

      if (oldVal === newVal) continue;
      if (oldVal === null && newVal === null) continue;

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

  return {
    sheets: sheetDiffs,
    summary: {
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
