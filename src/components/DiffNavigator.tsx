import React from 'react';
import { CellDiff } from '../types';

interface DiffNavigatorProps {
  diffs: CellDiff[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  threshold?: number;
  onThresholdChange?: (value: number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchMatchCount?: number;
  searchMatchIndex?: number;
  onSearchNext?: () => void;
  onSearchPrev?: () => void;
  activeTypes?: Set<string>;
  onToggleType?: (type: string) => void;
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
  threshold,
  onThresholdChange,
  searchQuery,
  onSearchChange,
  searchMatchCount,
  searchMatchIndex,
  onSearchNext,
  onSearchPrev,
  activeTypes,
  onToggleType,
}) => {
  const searchControl = onSearchChange ? (
    <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search cell or value..."
          value={searchQuery || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearchNext) {
              e.preventDefault();
              onSearchNext();
            }
          }}
          style={{
            width: 150,
            padding: '3px 24px 3px 6px',
            fontSize: 12,
            border: '1px solid #d1d5db',
            borderRadius: 4,
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#6b7280',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            x
          </button>
        )}
      </div>
      {searchQuery && searchMatchCount !== undefined && searchMatchCount > 0 && (
        <>
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
            {(searchMatchIndex ?? 0) + 1}/{searchMatchCount}
          </span>
          <button onClick={onSearchPrev} style={{ ...navBtnStyle, padding: '2px 6px', fontSize: 10 }}>↑</button>
          <button onClick={onSearchNext} style={{ ...navBtnStyle, padding: '2px 6px', fontSize: 10 }}>↓</button>
        </>
      )}
    </div>
  ) : null;
  const typeFilterPills = onToggleType ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
      {(['changed', 'added', 'removed'] as const).map((type) => {
        const colors = { changed: '#f59e0b', added: '#10b981', removed: '#ef4444' };
        const color = colors[type];
        const isActive = activeTypes?.has(type) ?? true;
        return (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 10,
              border: `1.5px solid ${color}`,
              backgroundColor: isActive ? color + '20' : 'transparent',
              color: isActive ? color : color + '60',
              cursor: 'pointer',
              textTransform: 'capitalize',
              opacity: isActive ? 1 : 0.5,
              transition: 'all 0.15s',
            }}
          >
            {type}
          </button>
        );
      })}
    </div>
  ) : null;

  const thresholdControl = onThresholdChange ? (
    <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Min $
      </label>
      <input
        type="text"
        placeholder="0"
        value={threshold ? String(threshold) : ''}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          onThresholdChange(val ? parseInt(val, 10) : 0);
        }}
        style={{
          width: 80,
          padding: '3px 6px',
          fontSize: 12,
          border: '1px solid #d1d5db',
          borderRadius: 4,
          outline: 'none',
        }}
      />
    </div>
  ) : null;

  if (diffs.length === 0) {
    return (
      <div className="diff-nav-bar" style={{ justifyContent: 'space-between' }}>
        <span style={{ color: '#6b7280', fontSize: 13 }}>
          No differences in this sheet
        </span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {typeFilterPills}
          {thresholdControl}
          {searchControl}
        </div>
      </div>
    );
  }

  return (
    <div className="diff-nav-bar">
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

      {typeFilterPills}
      {thresholdControl}
      {searchControl}
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
