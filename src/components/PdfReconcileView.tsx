import React, { useState, useEffect } from 'react';
import * as GC from '@mescius/spread-sheets';
import { PdfCheckResult } from '../types';
import { defaultChecks } from '../config/pdfChecks';
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
  const [results, setResults] = useState<PdfCheckResult[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<number>(0);

  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfFile]);

  useEffect(() => {
    if (workbookJson) {
      const hiddenHost = document.createElement('div');
      hiddenHost.style.position = 'absolute';
      hiddenHost.style.left = '-9999px';
      hiddenHost.style.width = '1000px';
      hiddenHost.style.height = '600px';
      document.body.appendChild(hiddenHost);
      const wb = new GC.Spread.Sheets.Workbook(hiddenHost, { sheetCount: 0 });
      wb.fromJSON(workbookJson);
      const checkResults = runChecks(wb, defaultChecks);
      setResults(checkResults);
      wb.destroy();
      document.body.removeChild(hiddenHost);
    }
  }, [workbookJson]);

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 380, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1f2937' }}>
          PDF ↔ Workbook Reconciliation
        </h3>

        {!pdfFile && (
          <button onClick={onRequestPdf} style={uploadBtnStyle}>
            Upload PDF Return
          </button>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, marginTop: 12 }}>
          <div style={{ ...statPill, borderColor: '#10b981' }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{passCount}</span> Pass
          </div>
          <div style={{ ...statPill, borderColor: '#ef4444' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{failCount}</span> Fail
          </div>
        </div>

        {results.map((result, i) => (
          <div
            key={result.check.id}
            onClick={() => setSelectedResult(i)}
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 6,
              cursor: 'pointer',
              backgroundColor: selectedResult === i ? '#f0f9ff' : '#fff',
              border: `1px solid ${selectedResult === i ? '#93c5fd' : '#e5e7eb'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>
                {result.status === 'pass' ? '✓' : '✗'}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: result.status === 'pass' ? '#166534' : '#991b1b',
                }}
              >
                {result.check.description}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, marginLeft: 24 }}>
              PDF value: {result.check.pdfValue.toLocaleString()}
              {result.check.allowSignFlip && ' (sign flip allowed)'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {results[selectedResult] && (
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
              {results[selectedResult].check.description}
            </h4>
            <div style={{ fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {results[selectedResult].message}
            </div>
          </div>
        )}

        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#page=${results[selectedResult]?.check.pdfPage || 1}`}
            style={{ flex: 1, border: 'none' }}
            title="PDF Return"
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
            }}
          >
            Upload a PDF to view the return alongside reconciliation results
          </div>
        )}
      </div>
    </div>
  );
};

const uploadBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const statPill: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 20,
  border: '1.5px solid',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};
