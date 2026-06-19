import { PdfCheck } from '../types';

export const defaultChecks: PdfCheck[] = [
  {
    id: 'total-assets',
    description: 'Total Assets (Page 5)',
    pdfPage: 5,
    pdfValue: 185420,
    workbookRefs: [
      { sheet: 'A3.4_BS', cell: 'K69' },
      { sheet: 'Summary', cell: 'I11' },
    ],
    allowSignFlip: false,
    tolerance: 1,
  },
  {
    id: 'retained-earnings',
    description: 'Retained Earnings (Page 8)',
    pdfPage: 8,
    pdfValue: -9917598,
    workbookRefs: [
      { sheet: 'A2_RE Rollforward', cell: 'K51' },
    ],
    allowSignFlip: true,
    tolerance: 1,
  },
];
