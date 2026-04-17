<!-- version-type: patch -->
# frontend

<!--
FORMATTING GUIDE:

### Detailed Entry (appears first when merging)

Use h3 (###) and below for detailed entries with paragraphs, code examples, and lists.

### Simple List Items

- Simple changes can be added as list items
- They are collected together at the bottom of each section

TIP: When multiple changelog drafts are merged, heading-based entries
appear before simple list items within each section.
-->

## ✨ Features

### Secret Warnings on Stack Dashboard

Added `SecretWarningsCard` component that appears on the stack dashboard when potential secrets are detected in service definitions. Warnings are grouped by service and show the pattern type, affected line, and a snippet of the offending content, with links to the relevant service detail page.

### Service List Filtering

Added `ServiceFilters` component to the services list with:
- Text search to filter services by name
- Status filter toggle buttons (Running, In Progress, Error, Pending)
- "Update All" button that triggers git pull for all visible services with commits behind their tracked branch

### Monaco Language Detection

Added `getMonacoLanguage()` utility that maps file extensions to Monaco editor language identifiers, enabling syntax highlighting for common file types in the file editor.

## 🐛 Bug Fixes

- Fixed a render loop in the `BulkActionBar` component caused by stale selection state being re-evaluated on every render
- Fixed incorrect action type being dispatched in service lifecycle action handlers

## 📚 Documentation
<!-- PLACEHOLDER: Describe documentation changes (docs:) -->

## ⚡ Performance
<!-- PLACEHOLDER: Describe performance improvements (perf:) -->

## ♻️ Refactoring

- Extracted `isServiceReady()` helper (checks clone, install, and build status) from the stack dashboard into a standalone `frontend/src/utils/is-service-ready.ts` module
- Updated `ServiceEnvOverrides` component to use `Checkbox` for boolean override selection and added toast notifications via `NotyService` on save/error

## 🧪 Tests

- Added unit tests for `isServiceReady()` utility covering various combinations of clone, install, and build status
- Added unit tests for service detail utilities

## 📦 Build
<!-- PLACEHOLDER: Describe build system changes (build:) -->

## 👷 CI
<!-- PLACEHOLDER: Describe CI configuration changes (ci:) -->

## ⬆️ Dependencies
<!-- PLACEHOLDER: Describe dependency updates (deps:) -->

## 🔧 Chores
<!-- PLACEHOLDER: Describe other changes (chore:) -->
