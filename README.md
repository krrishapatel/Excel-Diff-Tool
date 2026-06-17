# Excel Workbook Diff Tool

A browser-based tool for comparing two `.xlsx` workbooks side-by-side, built for tax preparation workflows. Identifies cell-level changes across sheets and provides a navigable diff interface using SpreadJS.

Includes a PDF-to-Workbook reconciliation extension for verifying that filed tax return values match the underlying workbook calculations.

## Setup & Run

```bash
npm install
npm start
```

Opens at `http://localhost:3000`.

## How to Use

1. **Upload** the prior year (base) and current year (new) `.xlsx` workbooks
2. **Compare** — the tool computes diffs across all sheets
3. **Review** — navigate changes using:
   - Left sidebar: sheet list sorted by modification status
   - Top toolbar: prev/next navigation through individual cell changes
   - Side-by-side SpreadJS views with highlighted differences
   - Bottom table: full list of changes for the selected sheet
4. **PDF Reconciliation** — switch to the reconciliation tab to verify workbook values against the filed PDF return

## Design Decisions

### Diff Strategy
- **Sheet matching by name** — sheets are matched between workbooks by exact name. New/removed sheets are flagged separately.
- **Value-first diffing** — cell value changes are the primary comparison unit (not formatting, styles, or metadata). Values are normalized (numbers rounded to 2 decimal places, empty/null treated equivalently) to reduce noise.
- **Performance cap** — SpreadJS viewer limits rendering to 500 rows x 50 columns per sheet to stay responsive with large workbooks. The diff engine processes all data.

### UI Approach
- Inspired by code diff tools (GitHub PR view): side-by-side panels with color-coded highlights
- Current diff is highlighted in yellow with an amber border; added cells are green, removed are red, changed are amber
- Navigation toolbar lets reviewers step through changes sequentially — critical for ensuring nothing is missed

### PDF Reconciliation (Extension)
- Configurable check definitions in `src/config/pdfChecks.ts` — each check specifies:
  - A PDF page and expected value
  - One or more workbook cell references to validate against
  - Whether sign flips are allowed (common in debit/credit accounting)
  - A tolerance threshold
- The system runs all checks against the loaded workbook and reports pass/fail with specific messages
- PDF is rendered via native browser iframe with page anchoring

### Architecture
- **React + TypeScript** — type safety for the complex diff data structures
- **SpreadJS** (30-day trial) — renders actual Excel content with formulas, formatting, column widths
- **ExcelIO** — parses `.xlsx` to SpreadJS JSON format entirely client-side (no server needed)
- **Workbook JSON** stored in refs — allows both the diff engine and SpreadJS viewers to operate on the same parsed data without re-parsing

## What I'd Do Next

- **Formula diffing** — compare formulas (not just computed values) to catch logic changes
- **Fuzzy sheet matching** — handle renamed sheets (e.g., "A5.3 AMT Dep" → "A5.3 AMT NBV") via similarity scoring
- **Filter/search** — let reviewers filter diffs by type, magnitude, or cell range
- **Materiality threshold** — flag changes above a configurable dollar threshold vs. minor rounding differences
- **PDF text extraction** — use pdf.js to auto-extract values from the tax return instead of manual config
- **Export diff report** — generate a printable summary for review documentation
- **Web Worker diffing** — move the diff computation off the main thread for large workbooks
