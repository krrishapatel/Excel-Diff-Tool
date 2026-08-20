import { getCellValueFromJson, runChecks } from './pdfReconcile';
import { PdfCheck } from '../types';
import { workbookJson } from './testFixtures';

const check = (over: Partial<PdfCheck> = {}): PdfCheck => ({
  id: 'c1',
  description: 'Total Assets',
  pdfPage: 5,
  pdfValue: 100,
  workbookRefs: [{ sheet: 'S', cell: 'A1' }],
  allowSignFlip: false,
  tolerance: 1,
  ...over,
});

describe('getCellValueFromJson', () => {
  const wb = workbookJson({ S: [[100, 'text'], [0, '(1,234)']] });

  it('resolves an A1 reference', () => {
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'A1' })).toBe(100);
  });

  it('is case insensitive on the column letter', () => {
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'a1' })).toBe(100);
  });

  it('handles multi letter columns', () => {
    const wide = workbookJson({ S: [Array.from({ length: 27 }, (_, c) => c)] });

    expect(getCellValueFromJson(wide, { sheet: 'S', cell: 'AA1' })).toBe(26);
  });

  it('matches a sheet name with stray whitespace', () => {
    const padded = workbookJson({ 'Summary ': [[7]] });

    expect(getCellValueFromJson(padded, { sheet: 'Summary', cell: 'A1' })).toBe(7);
  });

  it('returns null for anything it cannot resolve', () => {
    expect(getCellValueFromJson(null, { sheet: 'S', cell: 'A1' })).toBeNull();
    expect(getCellValueFromJson(wb, { sheet: 'Missing', cell: 'A1' })).toBeNull();
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'not-a-ref' })).toBeNull();
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'Z9' })).toBeNull();
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'B1' })).toBeNull();
  });

  it('reads a zero as zero, not as missing', () => {
    // `rowData[col] || rowData[String(col)]` threw away a 0 stored without a
    // wrapper, and the caller reports null as "value not found". A balance of 0
    // is a normal balance.
    const wrapped = workbookJson({ S: [[0]] });
    const bare = { sheets: { S: { data: { dataTable: { 0: { 0: 0 } } } } } };

    expect(getCellValueFromJson(wrapped, { sheet: 'S', cell: 'A1' })).toBe(0);
    expect(getCellValueFromJson(bare, { sheet: 'S', cell: 'A1' })).toBe(0);
  });

  it('parses an accounting negative', () => {
    // Finance exports write negatives in parentheses. parseFloat('(1,234)') is
    // NaN, so every parenthesised figure read as missing.
    expect(getCellValueFromJson(wb, { sheet: 'S', cell: 'B2' })).toBe(-1234);
  });

  it('strips currency and thousands separators', () => {
    const money = workbookJson({ S: [['$1,234.56', ' 42 ', '$(9,917,598.00)']] });

    expect(getCellValueFromJson(money, { sheet: 'S', cell: 'A1' })).toBeCloseTo(1234.56);
    expect(getCellValueFromJson(money, { sheet: 'S', cell: 'B1' })).toBe(42);
    expect(getCellValueFromJson(money, { sheet: 'S', cell: 'C1' })).toBeCloseTo(-9917598);
  });

  it('returns null for text that is not a number', () => {
    const words = workbookJson({ S: [['n/a', '', '-']] });

    expect(getCellValueFromJson(words, { sheet: 'S', cell: 'A1' })).toBeNull();
    expect(getCellValueFromJson(words, { sheet: 'S', cell: 'B1' })).toBeNull();
    expect(getCellValueFromJson(words, { sheet: 'S', cell: 'C1' })).toBeNull();
  });

  it('refuses a number with a note stuck to it rather than reading the digits', () => {
    // parseFloat('1234 (est)') is 1234. An estimate is not the figure to tick a
    // filed statement against, so this reports nothing found instead.
    const noted = workbookJson({ S: [['1,234 (est)', '12abc']] });

    expect(getCellValueFromJson(noted, { sheet: 'S', cell: 'A1' })).toBeNull();
    expect(getCellValueFromJson(noted, { sheet: 'S', cell: 'B1' })).toBeNull();
  });

  it('reads a cell stored as a bare value', () => {
    const bare = { sheets: { S: { data: { dataTable: { 0: { 0: 5 } } } } } };

    expect(getCellValueFromJson(bare, { sheet: 'S', cell: 'A1' })).toBe(5);
  });
});

describe('runChecks', () => {
  it('passes a value inside the tolerance', () => {
    const [result] = runChecks(workbookJson({ S: [[100.5]] }), [check()]);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('matches PDF');
  });

  it('fails a value outside the tolerance and shows the gap', () => {
    const [result] = runChecks(workbookJson({ S: [[150]] }), [check()]);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('50');
  });

  it('accepts a flipped sign only when the check allows it', () => {
    const wb = workbookJson({ S: [[-100]] });

    expect(runChecks(wb, [check({ allowSignFlip: true })])[0].status).toBe('pass');
    expect(runChecks(wb, [check({ allowSignFlip: false })])[0].status).toBe('fail');
  });

  it('defaults the tolerance to 1', () => {
    const [result] = runChecks(workbookJson({ S: [[102]] }), [check({ tolerance: undefined })]);

    expect(result.status).toBe('fail');
  });

  it('fails when a referenced cell is missing', () => {
    const [result] = runChecks(workbookJson({ S: [[]] }), [check()]);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('value not found');
  });

  it('fails if any one reference disagrees', () => {
    const wb = workbookJson({ S: [[100]], T: [[999]] });
    const [result] = runChecks(wb, [
      check({ workbookRefs: [{ sheet: 'S', cell: 'A1' }, { sheet: 'T', cell: 'A1' }] }),
    ]);

    expect(result.status).toBe('fail');
  });

  it('does not pass a check that has nothing to compare', () => {
    // allPass starts true and the loop never runs, so an empty check reported a
    // green tick against a figure it never looked for.
    const [result] = runChecks(workbookJson({ S: [[100]] }), [check({ workbookRefs: [] })]);

    expect(result.status).toBe('warning');
    expect(result.message).toContain('no workbook cells');
  });
});
