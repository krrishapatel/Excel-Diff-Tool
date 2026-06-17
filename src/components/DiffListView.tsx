import React from 'react';
import { CellDiff } from '../types';

interface DiffListViewProps {
  diffs: CellDiff[];
  currentIndex: number;
  onSelect: (index: number) => void;
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

function formatValue(val: any): string {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'string' && val.length > 30) return val.slice(0, 30) + '…';
  return String(val);
}

export const DiffListView: React.FC<DiffListViewProps> = ({ diffs, currentIndex, onSelect }) => {
  const typeColors = {
    changed: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
    added: { bg: '#dcfce7', text: '#166534', border: '#10b981' },
    removed: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  };

  return (
    <div style={{ overflowY: 'auto', maxHeight: 300, borderTop: '1px solid #e5e7eb' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Cell</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Old Value</th>
            <th style={thStyle}>New Value</th>
          </tr>
        </thead>
        <tbody>
          {diffs.slice(0, 500).map((diff, i) => {
            const colors = typeColors[diff.type];
            return (
              <tr
                key={i}
                onClick={() => onSelect(i)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: i === currentIndex ? '#eef2ff' : undefined,
                }}
              >
                <td style={tdStyle}>{i + 1}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 500 }}>
                  {colToLetter(diff.col)}
                  {diff.row + 1}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {diff.type}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: '#991b1b' }}>{formatValue(diff.oldValue)}</td>
                <td style={{ ...tdStyle, color: '#166534' }}>{formatValue(diff.newValue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {diffs.length > 500 && (
        <div style={{ padding: 8, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>
          Showing first 500 of {diffs.length} changes
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 11,
  color: '#6b7280',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid #f3f4f6',
};
