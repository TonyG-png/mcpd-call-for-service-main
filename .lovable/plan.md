
# Fix: Reports tab says "No report fields available"

## Root cause
`DataContext.availableFields` only checks the first 20 incidents to confirm a field has data. `cr_number` and `crash_reports` are **sparse by design** — the vast majority of calls don't generate a written report — so the 20-record sample almost always comes up empty and these fields get removed from `availableFields`. The Reports page then renders the empty-state.

## Fixes

1. **`src/context/DataContext.tsx` — make presence check robust to sparse fields**
   - Scan the full `incidents` array (capped, e.g. up to 5,000 records) instead of just 20, so sparse-but-real columns like `cr_number` and `crash_reports` are detected.
   - Performance is fine: a single pass over ≤5k records on each filter recompute is negligible, and this only runs when `incidents` or `fieldMapping` change.

2. **`src/pages/ReportsPage.tsx` — graceful handling**
   - Render the page as long as **at least one** of `crNumber` / `crashReport` is available (currently it bails unless both are present, due to the early-return logic).
   - Keep per-card / per-series gating so a missing field hides only its KPI card and chart line, not the whole page.

3. **Diagnostic logging (temporary)**
   - Add a one-line `console.log` in `DataContext` after mapping discovery that prints whether `crNumber` and `crashReport` are mapped, and how many incidents have non-empty values for each. Easy to remove once verified.

## Out of scope
- No changes to schema discovery heuristics — `cr_number` and `crash_reports` already match the patterns added in the previous step.
- No changes to data fetching — SODA already returns all columns per record.
