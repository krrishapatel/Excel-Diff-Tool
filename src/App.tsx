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
  const [searchQuery, setSearchQuery] = useState('');
  const [syncScrollTop, setSyncScrollTop] = useState<number | undefined>(undefined);
  const [syncScrollLeft, setSyncScrollLeft] = useState<number | undefined>(undefined);
  const [spreadPct, setSpreadPct] = useState(70);
  const [darkMode, setDarkMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<'changed' | 'added' | 'removed'>>(
    () => new Set(['changed', 'added', 'removed'] as const)
  );
  const resizeRef = useRef<{ startY: number; startPct: number } | null>(null);
  const diffMainRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startPct: spreadPct };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current || !diffMainRef.current) return;
      const containerHeight = diffMainRef.current.clientHeight;
      const deltaY = ev.clientY - resizeRef.current.startY;
      const deltaPct = (deltaY / containerHeight) * 100;
      const newPct = Math.min(90, Math.max(20, resizeRef.current.startPct + deltaPct));
      setSpreadPct(newPct);
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [spreadPct]);

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

  // Helper to convert column letter(s) to 0-based index
  const letterToCol = (letters: string): number => {
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return col - 1;
  };

  // Helper to convert col index to letter(s)
  const colToLetter = (col: number): string => {
    let result = '';
    let c = col;
    while (c >= 0) {
      result = String.fromCharCode((c % 26) + 65) + result;
      c = Math.floor(c / 26) - 1;
    }
    return result;
  };

  const cellRefPattern = /^([A-Za-z]{1,3})(\d+)$/;

  const currentDiffs = useMemo(() => {
    return filteredDiffs.filter((d) => activeTypes.has(d.type));
  }, [filteredDiffs, activeTypes]);

  const handleToggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type as 'changed' | 'added' | 'removed')) {
        // Don't allow disabling all types
        if (next.size > 1) {
          next.delete(type as 'changed' | 'added' | 'removed');
        }
      } else {
        next.add(type as 'changed' | 'added' | 'removed');
      }
      return next;
    });
    setCurrentDiffIndex(0);
  }, []);

  // Find all search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim();
    const cellMatch = q.match(cellRefPattern);
    if (cellMatch) {
      const refCol = letterToCol(cellMatch[1].toUpperCase());
      const refRow = parseInt(cellMatch[2], 10) - 1;
      if (refRow >= 0 && refCol >= 0) return [{ row: refRow, col: refCol }];
    }
    const qLower = q.toLowerCase();
    const matches: { row: number; col: number }[] = [];
    for (const d of filteredDiffs) {
      const oldStr = d.oldValue != null ? String(d.oldValue).toLowerCase() : '';
      const newStr = d.newValue != null ? String(d.newValue).toLowerCase() : '';
      if (oldStr.includes(qLower) || newStr.includes(qLower)) {
        matches.push({ row: d.row, col: d.col });
      }
    }
    return matches;
  }, [searchQuery, filteredDiffs]);

  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchQuery]);

  const searchHighlight = searchMatches.length > 0 ? searchMatches[searchMatchIndex % searchMatches.length] : null;

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentDiffIndex(0);
  }, []);

  const handleSyncScroll = useCallback((scrollTop: number, scrollLeft: number) => {
    setSyncScrollTop(scrollTop);
    setSyncScrollLeft(scrollLeft);
  }, []);

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
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowShortcuts(false);
        return;
      }

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

  const shortcutsModal = showShortcuts ? (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={() => setShowShortcuts(false)}
    >
      <div
        style={{
          background: darkMode ? '#1f2937' : '#fff',
          color: darkMode ? '#f3f4f6' : '#1f2937',
          borderRadius: 8,
          padding: '24px 32px',
          minWidth: 280,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Keyboard Shortcuts</h3>
        <table style={{ fontSize: 14, borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['j / ↓', 'Next diff'],
              ['k / ↑', 'Previous diff'],
              ['?', 'Show/hide this panel'],
              ['Esc', 'Close panel'],
            ].map(([key, desc]) => (
              <tr key={key}>
                <td style={{ padding: '4px 12px 4px 0', fontFamily: 'monospace', fontWeight: 600 }}>{key}</td>
                <td style={{ padding: '4px 0', color: darkMode ? '#9ca3af' : '#6b7280' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() => setShowShortcuts(false)}
          style={{
            marginTop: 16,
            padding: '6px 14px',
            border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
            borderRadius: 4,
            background: darkMode ? '#374151' : '#f3f4f6',
            color: darkMode ? '#f3f4f6' : '#374151',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`app-container full${darkMode ? ' dark' : ''}`}>
      {shortcutsModal}
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
            style={{ backgroundColor: '#059669', borderColor: '#059669', color: '#fff' }}
          >
            Download Report
          </button>
          <button className="reset-btn" onClick={() => { setMode('upload'); setDiff(null); }}>
            New Comparison
          </button>
          <button
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            {darkMode ? '☀️' : '🌙'}
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

        <div className="diff-main" ref={diffMainRef}>
          <DiffNavigator
            diffs={currentDiffs}
            currentIndex={currentDiffIndex}
            onNavigate={setCurrentDiffIndex}
            threshold={threshold}
            onThresholdChange={handleThresholdChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            searchMatchCount={searchMatches.length}
            searchMatchIndex={searchMatchIndex}
            onSearchNext={() => setSearchMatchIndex((i) => (i + 1) % Math.max(1, searchMatches.length))}
            onSearchPrev={() => setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % Math.max(1, searchMatches.length))}
            activeTypes={activeTypes}
            onToggleType={handleToggleType}
          />

          <div className="spread-container" style={{ flex: `${spreadPct} 0 0%` }}>
            <SpreadViewer
              workbookJson={oldJsonRef.current}
              sheetName={selectedSheet || ''}
              diffs={currentDiffs}
              currentDiffIndex={currentDiffIndex}
              label={oldFile?.name || 'Prior Year'}
              side="old"
              syncScrollTop={syncScrollTop}
              syncScrollLeft={syncScrollLeft}
              onSyncScroll={handleSyncScroll}
              searchHighlight={searchHighlight}
            />
            <SpreadViewer
              workbookJson={newJsonRef.current}
              sheetName={selectedSheet || ''}
              diffs={currentDiffs}
              currentDiffIndex={currentDiffIndex}
              label={newFile?.name || 'Current Year'}
              side="new"
              syncScrollTop={syncScrollTop}
              syncScrollLeft={syncScrollLeft}
              onSyncScroll={handleSyncScroll}
              searchHighlight={searchHighlight}
            />
          </div>

          <div
            className="resize-handle"
            onMouseDown={handleResizeStart}
          />

          <div style={{ flex: `${100 - spreadPct} 0 0%`, overflow: 'hidden' }}>
            <DiffListView
              diffs={currentDiffs}
              currentIndex={currentDiffIndex}
              onSelect={setCurrentDiffIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
