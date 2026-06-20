# Excel Workbook Diff Tool

A browser-based tool for comparing two `.xlsx` workbooks side-by-side, built for tax preparation workflows. Identifies cell-level changes across sheets and provides a navigable diff interface powered by SpreadJS ExcelIO.

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
   - Left sidebar: sheet list sorted by modification status (modified/added/removed)
   - Top toolbar: prev/next navigation through individual cell changes
   - Side-by-side panels with color-coded highlights
   - Bottom table: full list of changes for the selected sheet
   - Draggable divider between panels and table to resize
4. **Search** — type a cell reference (e.g., `K69`) or value (e.g., `185420`) to find and highlight matching cells with ↑↓ navigation
5. **Filter** — set a materiality threshold (Min $) to hide changes below a dollar amount
6. **Diff type pills** — toggle Changed/Added/Removed filters to focus on specific change types
7. **Export** — download a CSV report of all changes across all sheets
8. **Dark mode** — moon/sun toggle in the top right
9. **Keyboard shortcuts** — `j`/`k` or arrows to navigate diffs, `?` to view all shortcuts
10. **PDF Reconciliation** — switch to the reconciliation tab, upload the PDF return, and verify workbook values match the filed return

## Design Decisions

### Diff Strategy
- **Sheet matching by name** — sheets are matched between workbooks by exact name. New/removed sheets are flagged separately.
- **Value-first diffing** — cell value changes are the primary comparison unit (not formatting, styles, or metadata). Values are normalized (numbers rounded to 2 decimal places, empty/null treated equivalently) to reduce noise.
- **Materiality filtering** — numeric changes below a configurable threshold are hidden, surfacing only material differences for review.

### UI Approach
- Inspired by code diff tools (GitHub PR view): side-by-side panels with color-coded highlights
- Current diff highlighted in yellow; added cells are green, removed are red with strikethrough, changed are amber
- **Linked scroll** — both panels scroll together (vertical and horizontal) so rows stay aligned
- **Draggable resizer** — adjust the split between sheet panels and diff list table
- **Search with navigation** — find cells by reference or value, cycle through matches with ↑↓

### PDF Reconciliation (Extension)
- Checks auto-populate when PDF is uploaded (configurable — users can add/remove checks via UI)
- Each check specifies: PDF page, expected value, workbook cell reference(s), sign flip tolerance
- Clicking a check navigates the PDF viewer to the relevant page
- Handles sign flips (common in debit/credit accounting) and configurable tolerance thresholds

### Architecture
- **React + TypeScript** — type safety for complex diff data structures
- **SpreadJS ExcelIO** — parses `.xlsx` to JSON format entirely client-side (no server needed)
- **Lightweight HTML table rendering** — renders sheet data as native HTML tables for fast performance (SpreadJS canvas viewer caused layout/performance issues with large workbooks)
- **JSON-first approach** — workbook JSON stored in refs, both diff engine and viewers read directly from JSON without creating intermediate workbook instances
- **Fixed sidebar layout** — `position: fixed` sidebar ensures navigation is always accessible regardless of sheet content width

## What I'd Do Next

- **Formula diffing** — compare formulas (not just computed values) to catch logic changes
- **Fuzzy sheet matching** — handle renamed sheets (e.g., "A5.3 AMT Dep" → "A5.3 AMT NBV") via similarity scoring
- **PDF text extraction** — use pdf.js to auto-extract values from the tax return instead of manual check configuration
- **Web Worker diffing** — move diff computation off the main thread for very large workbooks
- **Batch reconciliation** — run checks across multiple returns simultaneously
- **Comment/annotation system** — let reviewers leave notes on specific diffs for team handoff
