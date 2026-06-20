import React, { useState, useEffect, useRef } from 'react';
import { PdfCheck, PdfCheckResult } from '../types';
import { runChecks } from '../engine/pdfReconcile';

interface PdfReconcileViewProps {
  workbookJson: any;
  pdfFile: File | null;
  onRequestPdf: () => void;
}

export const PdfReconcileView: React.FC<PdfReconcileViewProps> = ({
  workbookJson,
  pdfFile,
  onRequestPdf,
}) => {
  const [checks, setChecks] = useState<PdfCheck[]>([]);
  const [results, setResults] = useState<PdfCheckResult[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<number>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [newDesc, setNewDesc] = useState('');
  const [newPdfValue, setNewPdfValue] = useState('');
  const [newSheet, setNewSheet] = useState('');
  const [newCell, setNewCell] = useState('');
  const [newSignFlip, setNewSignFlip] = useState(false);
  const [newPdfPage, setNewPdfPage] = useState('1');

  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfFile]);

  useEffect(() => {
    if (workbookJson && checks.length > 0) {
      const checkResults = runChecks(workbookJson, checks);
      setResults(checkResults);
    } else {
      setResults([]);
    }
  }, [workbookJson, checks]);

  // Auto-add checks when PDF is uploaded
  useEffect(() => {
    if (pdfFile && checks.length === 0 && workbookJson) {
      setChecks([
        {
          id: 'total-assets',
          description: 'Total Assets',
          pdfPage: 5,
          pdfValue: 185420,
          workbookRefs: [{ sheet: 'A3.4_BS', cell: 'K69' }, { sheet: 'Summary', cell: 'I11' }],
          allowSignFlip: false,
          tolerance: 1,
        },
        {
          id: 'retained-earnings',
          description: 'Retained Earnings',
          pdfPage: 8,
          pdfValue: -9917598,
          workbookRefs: [{ sheet: 'A2_RE Rollforward', cell: 'K51' }],
          allowSignFlip: true,
          tolerance: 1,
        },
        {
          id: 'gross-receipts',
          description: 'Gross Receipts',
          pdfPage: 1,
          pdfValue: 5131,
          workbookRefs: [{ sheet: 'A3_P&L', cell: 'K10' }],
          allowSignFlip: true,
          tolerance: 1,
        },
        {
          id: 'officer-compensation',
          description: 'Officer Compensation',
          pdfPage: 1,
          pdfValue: 1805000,
          workbookRefs: [{ sheet: 'A3_P&L', cell: 'K20' }],
          allowSignFlip: false,
          tolerance: 1,
        },
        {
          id: 'total-deductions',
          description: 'Total Deductions',
          pdfPage: 1,
          pdfValue: 3745492,
          workbookRefs: [{ sheet: 'Summary', cell: 'I15' }],
          allowSignFlip: true,
          tolerance: 2,
        },
      ]);
    }
  }, [pdfFile, workbookJson, checks.length]);

  // Navigate PDF to the selected check's page and highlight the value
  const [pdfNavKey, setPdfNavKey] = useState(0);
  useEffect(() => {
    if (!pdfUrl || !results[selectedResult]) return;
    const check = results[selectedResult].check;
    const page = check.pdfPage;
    const searchValue = Math.abs(check.pdfValue).toLocaleString();
    if (iframeRef.current) {
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = `${pdfUrl}#page=${page}&search=${searchValue}`;
        }
      }, 50);
    }
  }, [selectedResult, pdfUrl, results, pdfNavKey]);

  const sheetNames = workbookJson ? Object.keys(workbookJson.sheets || {}) : [];

  const addCheck = () => {
    const pdfVal = parseFloat(newPdfValue.replace(/[,$]/g, ''));
    if (!newDesc || isNaN(pdfVal) || !newSheet || !newCell) return;
    setChecks([...checks, {
      id: `check-${Date.now()}`,
      description: newDesc,
      pdfPage: parseInt(newPdfPage) || 1,
      pdfValue: pdfVal,
      workbookRefs: [{ sheet: newSheet, cell: newCell.toUpperCase() }],
      allowSignFlip: newSignFlip,
      tolerance: 1,
    }]);
    setNewDesc('');
    setNewPdfValue('');
    setNewCell('');
    setNewSignFlip(false);
    setShowAddForm(false);
  };

  const removeCheck = (id: string) => {
    setChecks(checks.filter((c) => c.id !== id));
  };

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const selected = results[selectedResult];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar - same style as diff sidebar */}
      <div className="diff-sidebar" style={{ top: 49 }}>
        {!pdfFile ? (
          <button onClick={onRequestPdf} style={{ padding: '6px 10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, width: '100%', marginBottom: 8 }}>
            Upload PDF
          </button>
        ) : (
          <p style={{ fontSize: 14, color: '#059669', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {pdfFile.name}</p>
        )}

        {results.length > 0 && (
          <div style={{ marginBottom: 6, fontSize: 14 }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>{passCount} pass</span>{' '}
            <span style={{ color: '#dc2626', fontWeight: 700 }}>{failCount} fail</span>
          </div>
        )}

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer', fontSize: 14, background: '#f9fafb', marginBottom: 6, width: '100%' }}
        >
          {showAddForm ? 'Cancel' : '+ Add Check'}
        </button>

        {showAddForm && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: 6, marginBottom: 6 }}>
            <input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={inputStyle} />
            <input placeholder="PDF value" value={newPdfValue} onChange={(e) => setNewPdfValue(e.target.value)} style={inputStyle} />
            <input placeholder="Page #" value={newPdfPage} onChange={(e) => setNewPdfPage(e.target.value)} style={inputStyle} />
            <select value={newSheet} onChange={(e) => setNewSheet(e.target.value)} style={inputStyle}>
              <option value="">Sheet...</option>
              {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="Cell (e.g. K69)" value={newCell} onChange={(e) => setNewCell(e.target.value)} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
              <input type="checkbox" checked={newSignFlip} onChange={(e) => setNewSignFlip(e.target.checked)} />
              Sign flip
            </label>
            <button onClick={addCheck} style={{ padding: '4px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 14, width: '100%' }}>Add</button>
          </div>
        )}

        {results.map((result, i) => (
          <div
            key={result.check.id}
            onClick={() => { setSelectedResult(i); setPdfNavKey((k) => k + 1); }}
            style={{
              padding: '4px 6px',
              borderRadius: 4,
              marginBottom: 3,
              cursor: 'pointer',
              backgroundColor: selectedResult === i ? '#eef2ff' : 'transparent',
              border: selectedResult === i ? '1px solid #c7d2fe' : '1px solid transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: result.status === 'pass' ? '#16a34a' : '#dc2626' }}>
                {result.status === 'pass' ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {result.check.description}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeCheck(result.check.id); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14, padding: 0 }}
              >×</button>
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginLeft: 15 }}>
              p.{result.check.pdfPage} · {result.check.pdfValue.toLocaleString()}
            </div>
          </div>
        ))}

        {!pdfFile && checks.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 14, padding: 4 }}>Upload PDF to start</div>
        )}
      </div>

      {/* Right: PDF takes all remaining space, flush against sidebar */}
      <div style={{ position: 'fixed', left: 215, top: 49, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected && (
          <div style={{ padding: '4px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, fontSize: 14 }}>
            <strong>{selected.check.description}</strong> (Page {selected.check.pdfPage})
            <span style={{ marginLeft: 12, fontFamily: 'monospace', color: selected.status === 'pass' ? '#166534' : '#991b1b' }}>
              {selected.message.split('\n')[0]}
            </span>
          </div>
        )}

        {pdfUrl ? (
          <iframe
            ref={iframeRef}
            src={`${pdfUrl}#page=${selected?.check.pdfPage || 1}`}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title="PDF Return"
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
            Upload a PDF to see it here
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #d1d5db',
  borderRadius: 3,
  fontSize: 14,
  marginBottom: 4,
};
