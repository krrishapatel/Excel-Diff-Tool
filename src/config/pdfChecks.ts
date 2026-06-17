import { PdfCheck } from '../types';

export const defaultChecks: PdfCheck[] = [
  {
    id: 'total-assets',
    description: 'Total Assets (Form 1120-S, Page 5)',
    pdfPage: 5,
    pdfValue: 185420,
    workbookRefs: [
      { sheet: 'A3.4_BS', cell: 'K69', description: 'Balance Sheet total assets' },
      { sheet: 'Summary', cell: 'I11', description: 'Summary assets line' },
    ],
    allowSignFlip: false,
    tolerance: 1,
  },
  {
    id: 'retained-earnings',
    description: 'Retained Earnings (Form 1120-S, Page 8)',
    pdfPage: 8,
    pdfValue: -9917598,
    workbookRefs: [
      { sheet: 'A2_RE Rollforward', cell: 'K51', description: 'RE Rollforward ending balance' },
    ],
    allowSignFlip: true,
    tolerance: 1,
  },
  {
    id: 'gross-receipts',
    description: 'Gross Receipts (Form 1120-S, Page 1, Line 1a)',
    pdfPage: 1,
    pdfValue: 5131,
    workbookRefs: [
      { sheet: 'A3_P&L', cell: 'K10', description: 'P&L Gross Receipts' },
    ],
    allowSignFlip: true,
    tolerance: 1,
  },
  {
    id: 'officer-compensation',
    description: 'Compensation of Officers (Form 1120-S, Page 1, Line 7)',
    pdfPage: 1,
    pdfValue: 1805000,
    workbookRefs: [
      { sheet: 'A3_P&L', cell: 'K20', description: 'Officer compensation' },
    ],
    allowSignFlip: false,
    tolerance: 1,
  },
  {
    id: 'total-deductions',
    description: 'Total Deductions (Form 1120-S, Page 1, Line 20)',
    pdfPage: 1,
    pdfValue: 3745492,
    workbookRefs: [
      { sheet: 'Summary', cell: 'I15', description: 'Total Expense & COGS (Tax)' },
    ],
    allowSignFlip: true,
    tolerance: 2,
  },
];
