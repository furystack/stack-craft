<!-- version-type: patch -->
# frontend

## ✨ Features

### Bulk "Apply Files" for selected services

The bulk action bar on `/stacks/:stackName/services` now exposes an **Apply Files** button alongside Start / Stop / Setup / Restart / Update. Selecting one or more services and clicking it calls `POST /services/:id/apply-files` for each in sequence, surfacing a single success Noty, an aggregated `warning` Noty listing unresolved `{{NAME}}` placeholders grouped by service, and an `error` Noty for any services that failed outright. Failures on one service do not abort the rest — every selection is attempted.

This unblocks the "I edited stack environment variables and want every service file re-applied" flow without visiting every service detail page.

## 🐛 Bug Fixes

### `applyServiceFiles` surfaces unresolved template placeholders

The service-detail Files-tab "Apply" / "Apply All" button now emits a second `warning` Noty when the server reports any unresolved `{{NAME}}` placeholders for the written file(s). The message lists the missing variables (e.g. `.env: POSTGRES_USER, POSTGRES_PASSWORD`) so the user can correct the name mismatch in the stack environment instead of wondering why the file content was not interpolated.

## 🧪 Tests

- Added `bulk-actions.spec.ts` covering the new `bulkApplyFiles` helper (success Noty, warning Noty grouping by service, error Noty on per-service failures, no-warning happy path, and the `formatUnresolvedSummary` helper).
- Extended `service-detail/utils.spec.ts` with two new `applyServiceFiles` cases asserting the warning Noty appears for unresolved placeholders and stays absent when every placeholder is resolved.
- Replaced hard-coded `/tmp/...` paths in the payload-validator specs (`stack-form.spec.ts`, `import-stack.spec.ts`) with `os.tmpdir()`-based equivalents so the frontend `vitest` suite runs unmodified on Windows hosts (where `/tmp` does not exist) in addition to Linux and macOS.
