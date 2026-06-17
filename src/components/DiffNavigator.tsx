import React from 'react';
import { CellDiff } from '../types';

interface DiffNavigatorProps {
  diffs: CellDiff[];
  currentIndex: number;
  onNavigate: (index: number) => void;
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
  return String(val);
}

export const DiffNavigator: React.FC<DiffNavigatorProps> = ({
  diffs,
  currentIndex,
  onNavigate,
}) => {
  if (diffs.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
        No differences in this sheet
      </div>
    );
  }

  return (
    <div style={{ borderBottom: '1px solid #e5e7eb', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
        disabled={currentIndex === 0}
        style={navBtnStyle}
      >
        ← Prev
      </button>
      <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
        {currentIndex + 1} / {diffs.length}
      </span>
      <button
        onClick={() => onNavigate(Math.min(diffs.length - 1, currentIndex + 1))}
        disabled={currentIndex === diffs.length - 1}
        style={navBtnStyle}
      >
        Next →
      </button>

      {diffs[currentIndex] && (
        <div style={{ marginLeft: 16, fontSize: 13, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#6b7280' }}>
            Cell: <strong>{colToLetter(diffs[currentIndex].col)}{diffs[currentIndex].row + 1}</strong>
          </span>
          <DiffBadge diff={diffs[currentIndex]} />
        </div>
      )}
    </div>
  );
};

const DiffBadge: React.FC<{ diff: CellDiff }> = ({ diff }) => {
  const colors = { changed: '#f59e0b', added: '#10b981', removed: '#ef4444' };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span
        style={{
          backgroundColor: colors[diff.type] + '20',
          color: colors[diff.type],
          padding: '2px 6px',
          borderRadius: 4,
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        {diff.type}
      </span>
      {diff.type === 'changed' && (
        <>
          <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>
            {formatValue(diff.oldValue)}
          </span>
          <span>→</span>
          <span style={{ color: '#10b981', fontWeight: 500 }}>
            {formatValue(diff.newValue)}
          </span>
        </>
      )}
      {diff.type === 'added' && (
        <span style={{ color: '#10b981' }}>{formatValue(diff.newValue)}</span>
      )}
      {diff.type === 'removed' && (
        <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>
          {formatValue(diff.oldValue)}
        </span>
      )}
    </span>
  );
};

const navBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
