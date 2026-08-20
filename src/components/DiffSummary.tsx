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
    <div className="diff-sidebar">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{diff.summary.sheetsModified}</span>
        <span style={{ color: '#10b981', fontWeight: 700 }}>+{diff.summary.sheetsAdded}</span>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>-{diff.summary.sheetsRemoved}</span>
      </div>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
        {diff.summary.totalCellChanges.toLocaleString()} changes
      </p>
      {diff.summary.truncatedSheets.length > 0 && (
        <p style={{ fontSize: 13, color: '#b45309', margin: '0 0 8px' }}>
          Too big to read in full, so cells past the limit were not compared:{' '}
          {diff.summary.truncatedSheets.join(', ')}
        </p>
      )}
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
        padding: '4px 6px',
        borderRadius: 4,
        marginBottom: 2,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eef2ff' : 'transparent',
        border: isSelected ? '1px solid #c7d2fe' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
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
            fontSize: 14,
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
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {total} change{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};
