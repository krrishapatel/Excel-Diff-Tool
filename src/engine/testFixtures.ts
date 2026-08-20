// Builds the shape ExcelIO hands back: workbook.sheets[name].data.dataTable[row][col].value
// Only what the engine reads, so a fixture stays readable as a 2D array.

export function sheetJson(rows: any[][]) {
  const dataTable: Record<number, Record<number, any>> = {};
  rows.forEach((row, r) => {
    const rowData: Record<number, any> = {};
    row.forEach((value, c) => {
      if (value !== undefined) rowData[c] = { value };
    });
    dataTable[r] = rowData;
  });
  return { data: { dataTable } };
}

export function workbookJson(sheets: Record<string, any[][]>) {
  const out: Record<string, any> = {};
  for (const name of Object.keys(sheets)) {
    out[name] = sheetJson(sheets[name]);
  }
  return { sheets: out };
}
