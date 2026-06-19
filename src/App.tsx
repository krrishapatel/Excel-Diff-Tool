import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as ExcelIO from '@mescius/spread-excelio';
import { FileUpload } from './components/FileUpload';
import { DiffSummary } from './components/DiffSummary';
import { DiffNavigator } from './components/DiffNavigator';
import { SpreadViewer } from './components/SpreadViewer';
import { DiffListView } from './components/DiffListView';
import { PdfReconcileView } from './components/PdfReconcileView';
import { computeDiff, extractSheetData } from './engine/diff';
import { WorkbookDiff, CellDiff } from './types';
import './App.css';

type AppMode = 'upload' | 'diff' | 'reconcile';

function App() {
  const [mode, setMode] = useState<AppMode>('upload');
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [diff, setDiff] = useState<WorkbookDiff | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0);

  const oldJsonRef = useRef<any>(null);
  const newJsonRef = useRef<any>(null);

  const loadWorkbookJson = useCallback((file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const excelIo = new ExcelIO.IO();
        excelIo.open(
          new Blob([e.target!.result as ArrayBuffer]),
          (json: any) => resolve(json),
          (err: any) => reject(err)
        );
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleCompare = useCallback(async () => {
    if (!oldFile || !newFile) return;
    setLoading(true);
    setError(null);

    try {
      const [oldJson, newJson] = await Promise.all([
        loadWorkbookJson(oldFile),
        loadWorkbookJson(newFile),
      ]);

      oldJsonRef.current = oldJson;
      newJsonRef.current = newJson;

      const oldSheets = extractSheetData(oldJson);
      const newSheets = extractSheetData(newJson);
      const result = computeDiff(oldSheets, newSheets);

      setDiff(result);
      setMode('diff');

      const firstModified = result.sheets.find((s) => s.status === 'modified');
      if (firstModified) {
        setSelectedSheet(firstModified.name);
      } else if (result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0].name);
      }
      setCurrentDiffIndex(0);
    } catch (err: any) {
      setError(err.message || 'Failed to compare workbooks');
    } finally {
      setLoading(false);
    }
  }, [oldFile, newFile, loadWorkbookJson]);

  const handlePdfUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) setPdfFile(file);
    };
    input.click();
  }, []);

  const selectedSheetDiff = diff?.sheets.find((s) => s.name === selectedSheet);
  const allCurrentDiffs = selectedSheetDiff?.cellDiffs || [];

  const filteredDiffs = useMemo(() => {
    if (threshold <= 0) return allCurrentDiffs;
    return allCurrentDiffs.filter((d: CellDiff) => {
      const oldNum = typeof d.oldValue === 'number' ? d.oldValue : parseFloat(d.oldValue);
      const newNum = typeof d.newValue === 'number' ? d.newValue : parseFloat(d.newValue);
      if (isNaN(oldNum) && isNaN(newNum)) return true; // non-numeric always shown
      const oldVal = isNaN(oldNum) ? 0 : oldNum;
      const newVal = isNaN(newNum) ? 0 : newNum;
      return Math.abs(newVal - oldVal) >= threshold;
    });
  }, [allCurrentDiffs, threshold]);

  const currentDiffs = filteredDiffs;

  const handleExportCsv = useCallback(() => {
    if (!diff) return;
    const rows: string[] = ['Sheet,Cell,Type,Old Value,New Value'];
    const escCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const colToLetter = (col: number): string => {
      let result = '';
      let c = col;
      while (c >= 0) {
        result = String.fromCharCode((c % 26) + 65) + result;
        c = Math.floor(c / 26) - 1;
      }
      return result;
    };
    for (const sheet of diff.sheets) {
      for (const d of sheet.cellDiffs) {
        const cell = colToLetter(d.col) + (d.row + 1);
        rows.push(
          `${escCsv(sheet.name)},${cell},${d.type},${escCsv(d.oldValue)},${escCsv(d.newValue)}`
        );
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diff-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [diff]);

  // Clamp currentDiffIndex when filtered list shrinks
  useEffect(() => {
    if (currentDiffs.length > 0 && currentDiffIndex >= currentDiffs.length) {
      setCurrentDiffIndex(currentDiffs.length - 1);
    }
  }, [currentDiffs.length, currentDiffIndex]);

  const handleThresholdChange = useCallback((val: number) => {
    setThreshold(val);
    setCurrentDiffIndex(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'diff' || currentDiffs.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCurrentDiffIndex((i) => Math.min(currentDiffs.length - 1, i + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCurrentDiffIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, currentDiffs.length]);

  if (mode === 'upload') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>Excel Workbook Diff</h1>
          <p>Compare two .xlsx workbooks to identify changes across sheets</p>
        </header>

        <div className="upload-area">
          <div className="upload-grid">
            <FileUpload
              label="Prior Year / Base File"
              onFile={setOldFile}
              fileName={oldFile?.name}
            />
            <FileUpload
              label="Current Year / New File"
              onFile={setNewFile}
              fileName={newFile?.name}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="compare-btn"
            onClick={handleCompare}
            disabled={!oldFile || !newFile || loading}
          >
            {loading ? 'Comparing...' : 'Compare Workbooks'}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'reconcile') {
    return (
      <div className="app-container full">
        <header className="app-header compact">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1>Excel Workbook Diff</h1>
            <nav className="mode-nav">
              <button onClick={() => setMode('diff')}>
                Workbook Diff
              </button>
              <button className="active" onClick={() => setMode('reconcile')}>
                PDF Reconciliation
              </button>
            </nav>
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PdfReconcileView
            workbookJson={newJsonRef.current}
            pdfFile={pdfFile}
            onRequestPdf={handlePdfUpload}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container full">
      <header className="app-header compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1>Excel Workbook Diff</h1>
          <nav className="mode-nav">
            <button className="active" onClick={() => setMode('diff')}>
              Workbook Diff
            </button>
            <button onClick={() => setMode('reconcile')}>
              PDF Reconciliation
            </button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="reset-btn"
            onClick={handleExportCsv}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
          >
            Download Report
          </button>
          <button className="reset-btn" onClick={() => { setMode('upload'); setDiff(null); }}>
            New Comparison
          </button>
        </div>
      </header>

      <div className="diff-layout">
        {diff && (
          <DiffSummary
            diff={diff}
            selectedSheet={selectedSheet}
            onSelectSheet={(name) => {
              setSelectedSheet(name);
              setCurrentDiffIndex(0);
            }}
          />
        )}

        <div className="diff-main">
          <DiffNavigator
            diffs={currentDiffs}
            currentIndex={currentDiffIndex}
            onNavigate={setCurrentDiffIndex}
            threshold={threshold}
            onThresholdChange={handleThresholdChange}
          />

          <div className="spread-container">
            <SpreadViewer
              workbookJson={oldJsonRef.current}
              sheetName={selectedSheet || ''}
              diffs={currentDiffs}
              currentDiffIndex={currentDiffIndex}
              label={oldFile?.name || 'Prior Year'}
              side="old"
            />
            <SpreadViewer
              workbookJson={newJsonRef.current}
              sheetName={selectedSheet || ''}
              diffs={currentDiffs}
              currentDiffIndex={currentDiffIndex}
              label={newFile?.name || 'Current Year'}
              side="new"
            />
          </div>

          <DiffListView
            diffs={currentDiffs}
            currentIndex={currentDiffIndex}
            onSelect={setCurrentDiffIndex}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
