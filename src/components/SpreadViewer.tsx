import React, { useMemo, useEffect, useRef } from 'react';
import { CellDiff } from '../types';

interface SpreadViewerProps {
  workbookJson: any;
  sheetName: string;
  diffs: CellDiff[];
  currentDiffIndex: number;
  label: string;
  side: 'old' | 'new';
}

function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

function getSheetData(workbookJson: any, sheetName: string): { rows: any[][]; maxCol: number } {
  if (!workbookJson?.sheets?.[sheetName]) return { rows: [], maxCol: 0 };
  const sheetJson = workbookJson.sheets[sheetName];
  const dataTable = sheetJson?.data?.dataTable;
  if (!dataTable) return { rows: [], maxCol: 0 };

  const rowKeys = Object.keys(dataTable).map(Number).sort((a, b) => a - b);
  if (rowKeys.length === 0) return { rows: [], maxCol: 0 };

  const maxRow = Math.min(rowKeys[rowKeys.length - 1] + 1, 300);
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
  maxCol = Math.min(maxCol + 1, 30);

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

  return { rows, maxCol };
}

export const SpreadViewer: React.FC<SpreadViewerProps> = ({
  workbookJson,
  sheetName,
  diffs,
  currentDiffIndex,
  label,
  side,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { rows, maxCol } = useMemo(() => getSheetData(workbookJson, sheetName), [workbookJson, sheetName]);

  const diffSet = useMemo(() => {
    const map = new Map<string, { type: CellDiff['type']; index: number }>();
    diffs.forEach((d, i) => map.set(`${d.row},${d.col}`, { type: d.type, index: i }));
    return map;
  }, [diffs]);

  const currentDiff = diffs[currentDiffIndex];

  // Reset scroll to top-left when sheet changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
  }, [sheetName]);

  // Scroll to current diff
  useEffect(() => {
    if (!currentDiff || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-cell="${currentDiff.row},${currentDiff.col}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [currentDiff]);

  if (rows.length === 0) {
    return (
      <div className="spread-panel">
        <div className={`spread-panel-header ${side}`}>{label}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          {sheetName ? 'Sheet not found in this workbook' : 'Select a sheet'}
        </div>
      </div>
    );
  }

  return (
    <div className="spread-panel">
      <div className={`spread-panel-header ${side}`}>{label}</div>
      <div className="sheet-scroll" ref={scrollRef}>
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="corner-header"></th>
              {Array.from({ length: maxCol }, (_, c) => (
                <th key={c} className="col-header">{colToLetter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className="row-header">{r + 1}</td>
                {row.map((val, c) => {
                  const key = `${r},${c}`;
                  const entry = diffSet.get(key);
                  const isCurrent = currentDiff?.row === r && currentDiff?.col === c;

                  let cls = '';
                  if (isCurrent) cls = 'cell-current';
                  else if (entry) {
                    if (entry.type === 'added' && side === 'new') cls = 'cell-added';
                    else if (entry.type === 'removed' && side === 'old') cls = 'cell-removed';
                    else if (entry.type === 'changed') cls = 'cell-changed';
                  }

                  return (
                    <td key={c} className={cls || undefined} data-cell={key}>
                      {formatValue(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(Math.round(val * 100) / 100);
  }
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return String(val);
}
