import React, { useRef, useEffect } from 'react';
import * as GC from '@mescius/spread-sheets';
import '@mescius/spread-sheets/styles/gc.spread.sheets.excel2016colorful.css';
import { CellDiff } from '../types';

interface SpreadViewerProps {
  workbookJson: any;
  sheetName: string;
  diffs: CellDiff[];
  currentDiffIndex: number;
  label: string;
  side: 'old' | 'new';
}

export const SpreadViewer: React.FC<SpreadViewerProps> = ({
  workbookJson,
  sheetName,
  diffs,
  currentDiffIndex,
  label,
  side,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<GC.Spread.Sheets.Workbook | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const spread = new GC.Spread.Sheets.Workbook(hostRef.current, {
      sheetCount: 0,
    });
    spreadRef.current = spread;

    return () => {
      spread.destroy();
    };
  }, []);

  useEffect(() => {
    if (!spreadRef.current || !workbookJson) return;

    const spread = spreadRef.current;
    spread.suspendPaint();

    spread.fromJSON(workbookJson);

    let targetIndex = -1;
    for (let i = 0; i < spread.getSheetCount(); i++) {
      if (spread.getSheet(i).name() === sheetName) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      spread.setActiveSheetIndex(targetIndex);
      const sheet = spread.getActiveSheet();
      applyDiffHighlights(sheet, diffs, side, currentDiffIndex);
    }

    spread.resumePaint();
  }, [workbookJson, sheetName, diffs, currentDiffIndex, side]);

  useEffect(() => {
    if (!spreadRef.current || diffs.length === 0 || currentDiffIndex < 0) return;
    const diff = diffs[currentDiffIndex];
    if (!diff) return;

    const sheet = spreadRef.current.getActiveSheet();
    if (sheet) {
      sheet.showRow(diff.row, GC.Spread.Sheets.VerticalPosition.center);
      sheet.showColumn(diff.col, GC.Spread.Sheets.HorizontalPosition.center);
      sheet.setActiveCell(diff.row, diff.col);
    }
  }, [currentDiffIndex, diffs]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          padding: '6px 12px',
          backgroundColor: side === 'old' ? '#fef2f2' : '#f0fdf4',
          borderBottom: `2px solid ${side === 'old' ? '#fca5a5' : '#86efac'}`,
          fontSize: 12,
          fontWeight: 600,
          color: side === 'old' ? '#991b1b' : '#166534',
        }}
      >
        {label}
      </div>
      <div ref={hostRef} style={{ flex: 1 }} />
    </div>
  );
};

function applyDiffHighlights(
  sheet: GC.Spread.Sheets.Worksheet,
  diffs: CellDiff[],
  side: 'old' | 'new',
  currentIndex: number
) {
  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    const isCurrent = i === currentIndex;

    let bgColor: string;
    if (isCurrent) {
      bgColor = '#fef08a';
    } else if (diff.type === 'added') {
      bgColor = side === 'new' ? '#dcfce7' : '#f3f4f6';
    } else if (diff.type === 'removed') {
      bgColor = side === 'old' ? '#fee2e2' : '#f3f4f6';
    } else {
      bgColor = '#fef3c7';
    }

    const style = new GC.Spread.Sheets.Style();
    style.backColor = bgColor;
    if (isCurrent) {
      style.borderLeft = new GC.Spread.Sheets.LineBorder('#f59e0b', GC.Spread.Sheets.LineStyle.medium);
      style.borderRight = new GC.Spread.Sheets.LineBorder('#f59e0b', GC.Spread.Sheets.LineStyle.medium);
      style.borderTop = new GC.Spread.Sheets.LineBorder('#f59e0b', GC.Spread.Sheets.LineStyle.medium);
      style.borderBottom = new GC.Spread.Sheets.LineBorder('#f59e0b', GC.Spread.Sheets.LineStyle.medium);
    }

    sheet.setStyle(diff.row, diff.col, style);
  }
}
