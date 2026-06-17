import React from 'react';
import { WorkbookDiff, SheetDiff } from '../types';

interface DiffSummaryProps {
  diff: WorkbookDiff;
  selectedSheet: string | null;
  onSelectSheet: (name: string) => void;
}

export const DiffSummary: React.FC<DiffSummaryProps> = ({ diff, selectedSheet, onSelectSheet }) => {
  const sortedSheets = [...diff.sheets].sort((a, b) => {
    const order = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <div style={{ width: 280, borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280' }}>Summary</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatBox label="Modified" value={diff.summary.sheetsModified} color="#f59e0b" />
        <StatBox label="Added" value={diff.summary.sheetsAdded} color="#10b981" />
        <StatBox label="Removed" value={diff.summary.sheetsRemoved} color="#ef4444" />
        <StatBox label="Unchanged" value={diff.summary.sheetsUnchanged} color="#6b7280" />
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        {diff.summary.totalCellChanges.toLocaleString()} total cell changes
      </p>

      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280' }}>Sheets</h3>
      {sortedSheets.map((sheet) => (
        <SheetRow
          key={sheet.name}
          sheet={sheet}
          isSelected={selectedSheet === sheet.name}
          onClick={() => onSelectSheet(sheet.name)}
        />
      ))}
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    style={{
      background: '#f9fafb',
      borderRadius: 6,
      padding: '8px 12px',
      borderLeft: `3px solid ${color}`,
    }}
  >
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
  </div>
);

const SheetRow: React.FC<{ sheet: SheetDiff; isSelected: boolean; onClick: () => void }> = ({
  sheet,
  isSelected,
  onClick,
}) => {
  const statusColors = {
    modified: '#f59e0b',
    added: '#10b981',
    removed: '#ef4444',
    unchanged: '#d1d5db',
  };
  const total = sheet.summary.changed + sheet.summary.added + sheet.summary.removed;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        marginBottom: 4,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eef2ff' : 'transparent',
        border: isSelected ? '1px solid #c7d2fe' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: statusColors[sheet.status],
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isSelected ? 600 : 400,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sheet.name}
        </div>
        {total > 0 && (
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {total} change{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};
