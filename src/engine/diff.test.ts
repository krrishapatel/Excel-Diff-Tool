import { computeDiff, extractSheetData, MAX_COLS, MAX_ROWS, SheetData } from './diff';
import { workbookJson } from './testFixtures';

function sheetData(name: string, rows: any[][]): SheetData {
  const [sheet] = extractSheetData(workbookJson({ [name]: rows }));
  return sheet;
}

describe('extractSheetData', () => {
  it('reads values into a dense grid', () => {
    const sheets = extractSheetData(
      workbookJson({ Summary: [['Revenue', 100], ['Costs', 40]] })
    );

    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Summary');
    expect(sheets[0].rowCount).toBe(2);
    expect(sheets[0].colCount).toBe(2);
    expect(sheets[0].rows).toEqual([['Revenue', 100], ['Costs', 40]]);
  });

  it('fills gaps with null instead of leaving holes', () => {
    const sheet = sheetData('S', [['a'], ['b', 'c']]);

    expect(sheet.rows).toEqual([['a', null], ['b', 'c']]);
  });

  it('returns an empty sheet rather than throwing when there is no data table', () => {
    const sheets = extractSheetData({ sheets: { Empty: {} } });

    expect(sheets).toEqual([
      { name: 'Empty', rows: [], rowCount: 0, colCount: 0, truncated: false },
    ]);
  });

  it('returns nothing for a workbook with no sheets', () => {
    expect(extractSheetData(null)).toEqual([]);
    expect(extractSheetData({})).toEqual([]);
  });

  it('sizes the grid from the highest row index, not the row count', () => {
    const dataTable: Record<number, any> = { 0: { 0: { value: 'top' } }, 99: { 0: { value: 'bottom' } } };
    const sheets = extractSheetData({ sheets: { Sparse: { data: { dataTable } } } });

    expect(sheets[0].rowCount).toBe(100);
    expect(sheets[0].rows[99]).toEqual(['bottom']);
  });

  it('reports truncation instead of dropping rows silently', () => {
    // The cap used to be 500 rows with nothing to say so. A model taller than
    // the cap compared clean below it and the rows past it were never read.
    const tall = Array.from({ length: MAX_ROWS + 10 }, (_, r) => [r]);
    const sheet = sheetData('Tall', tall);

    expect(sheet.rowCount).toBe(MAX_ROWS);
    expect(sheet.truncated).toBe(true);
  });

  it('reports truncation on width too', () => {
    const wide = [Array.from({ length: MAX_COLS + 5 }, (_, c) => c)];
    const sheet = sheetData('Wide', wide);

    expect(sheet.colCount).toBe(MAX_COLS);
    expect(sheet.truncated).toBe(true);
  });

  it('does not flag an ordinary sheet as truncated', () => {
    expect(sheetData('S', [[1, 2], [3, 4]]).truncated).toBe(false);
  });
});

describe('computeDiff', () => {
  it('calls identical sheets unchanged', () => {
    const rows = [['Revenue', 100]];
    const diff = computeDiff([sheetData('S', rows)], [sheetData('S', rows)]);

    expect(diff.sheets[0].status).toBe('unchanged');
    expect(diff.summary.totalCellChanges).toBe(0);
    expect(diff.summary.sheetsUnchanged).toBe(1);
  });

  it('classifies changed, added and removed cells', () => {
    const before = sheetData('S', [['Revenue', 100], ['Costs', 40]]);
    const after = sheetData('S', [['Revenue', 120], ['Costs', 40, 'new']]);
    const diff = computeDiff([before], [after]);

    expect(diff.sheets[0].status).toBe('modified');
    const changed = diff.sheets[0].cellDiffs.find((d) => d.type === 'changed');
    expect(changed).toMatchObject({ row: 0, col: 1, oldValue: 100, newValue: 120 });
    expect(diff.sheets[0].summary.added).toBe(1);
    expect(diff.summary.totalCellChanges).toBe(2);
  });

  it('reports a cleared cell as removed', () => {
    const diff = computeDiff(
      [sheetData('S', [['a', 'b']])],
      [sheetData('S', [['a', '']])]
    );

    expect(diff.sheets[0].cellDiffs).toHaveLength(1);
    expect(diff.sheets[0].cellDiffs[0]).toMatchObject({ type: 'removed', oldValue: 'b', newValue: null });
  });

  it('treats a whole new sheet as added and a missing one as removed', () => {
    const diff = computeDiff([sheetData('Gone', [['x']])], [sheetData('Fresh', [['y']])]);

    expect(diff.summary.sheetsAdded).toBe(1);
    expect(diff.summary.sheetsRemoved).toBe(1);
    expect(diff.sheets.find((s) => s.name === 'Fresh')!.status).toBe('added');
    expect(diff.sheets.find((s) => s.name === 'Gone')!.status).toBe('removed');
  });

  it('ignores blank cells when reporting an added sheet', () => {
    const diff = computeDiff([], [sheetData('Fresh', [['y', null], [null, null]])]);

    expect(diff.sheets[0].cellDiffs).toHaveLength(1);
    expect(diff.sheets[0].summary.added).toBe(1);
  });

  it('flags a number that turned into text', () => {
    // String(5) === String('5'), so this used to compare clean. In a workbook it
    // is a real break: the text cell stops feeding the formulas above it.
    const diff = computeDiff([sheetData('S', [[5]])], [sheetData('S', [['5']])]);

    expect(diff.sheets[0].cellDiffs).toHaveLength(1);
    expect(diff.sheets[0].cellDiffs[0]).toMatchObject({ type: 'changed', oldValue: 5, newValue: '5' });
  });

  it('rounds to cents before comparing', () => {
    const diff = computeDiff([sheetData('S', [[1.001]])], [sheetData('S', [[1.002]])]);

    expect(diff.sheets[0].status).toBe('unchanged');
  });

  it('names the truncated sheets in the summary', () => {
    const tall = Array.from({ length: MAX_ROWS + 1 }, (_, r) => [r]);
    const diff = computeDiff([sheetData('Tall', tall)], [sheetData('Tall', tall)]);

    expect(diff.summary.truncatedSheets).toEqual(['Tall']);
  });

  it('leaves truncatedSheets empty for a workbook that fits', () => {
    const diff = computeDiff([sheetData('S', [[1]])], [sheetData('S', [[1]])]);

    expect(diff.summary.truncatedSheets).toEqual([]);
  });
});
