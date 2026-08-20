export interface CellDiff {
  sheet: string;
  row: number;
  col: number;
  oldValue: any;
  newValue: any;
  type: 'changed' | 'added' | 'removed';
  formula?: { old?: string; new?: string };
}

export interface SheetDiff {
  name: string;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
  cellDiffs: CellDiff[];
  summary: {
    changed: number;
    added: number;
    removed: number;
  };
}

export interface WorkbookDiff {
  sheets: SheetDiff[];
  summary: {
    // Sheets bigger than the read limit. Cells past it were not compared.
    truncatedSheets: string[];
    sheetsAdded: number;
    sheetsRemoved: number;
    sheetsModified: number;
    sheetsUnchanged: number;
    totalCellChanges: number;
  };
}

export interface PdfCheck {
  id: string;
  description: string;
  pdfPage: number;
  pdfValue: number;
  workbookRefs: WorkbookRef[];
  allowSignFlip: boolean;
  tolerance?: number;
}

export interface WorkbookRef {
  sheet: string;
  cell: string;
  description?: string;
}

export interface PdfCheckResult {
  check: PdfCheck;
  status: 'pass' | 'fail' | 'warning';
  actualValues: { ref: WorkbookRef; value: number | null }[];
  message: string;
}

export type ViewMode = 'side-by-side' | 'overlay' | 'list';
