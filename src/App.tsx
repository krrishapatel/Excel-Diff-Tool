import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as GC from '@mescius/spread-sheets';
import * as ExcelIO from '@mescius/spread-excelio';
import { FileUpload } from './components/FileUpload';
import { DiffSummary } from './components/DiffSummary';
import { DiffNavigator } from './components/DiffNavigator';
import { SpreadViewer } from './components/SpreadViewer';
import { DiffListView } from './components/DiffListView';
import { PdfReconcileView } from './components/PdfReconcileView';
import { computeDiff, extractSheetData } from './engine/diff';
import { WorkbookDiff } from './types';
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

  const jsonToWorkbook = useCallback((json: any): any => {
    const hiddenHost = document.createElement('div');
    hiddenHost.style.position = 'absolute';
    hiddenHost.style.left = '-9999px';
    hiddenHost.style.width = '1000px';
    hiddenHost.style.height = '600px';
    document.body.appendChild(hiddenHost);
    const wb = new GC.Spread.Sheets.Workbook(hiddenHost, { sheetCount: 0 });
    wb.fromJSON(json);
    document.body.removeChild(hiddenHost);
    return wb;
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

      const oldWb = jsonToWorkbook(oldJson);
      const newWb = jsonToWorkbook(newJson);

      const oldSheets = extractSheetData(oldWb);
      const newSheets = extractSheetData(newWb);
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
  }, [oldFile, newFile, loadWorkbookJson, jsonToWorkbook]);

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
  const currentDiffs = selectedSheetDiff?.cellDiffs || [];

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
        <button className="reset-btn" onClick={() => { setMode('upload'); setDiff(null); }}>
          New Comparison
        </button>
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
