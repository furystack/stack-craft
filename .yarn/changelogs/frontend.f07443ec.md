<!-- version-type: patch -->
# frontend

## ✨ Features

### Services is now the stack default page

Opening a stack (`/stacks/:stackName`) or the legacy Setup route (`/stacks/:stackName/setup`) redirects to **Services**. Create, import, and service-wizard flows land on Services directly so day-to-day work starts on the page you actually use.

### Stack actions menu on Services

A **Stack actions** menu (`⋯`) on the Services header groups stack-level operations that previously lived only on Overview:

- **Edit Stack** — open stack settings
- **Export Stack** — export stack configuration
- **Set Up All** — run the stack batch setup endpoint (`POST /stacks/:id/setup`) for every service

### Sidebar stack status at a glance

Each stack in the sidebar accordion shows a **traffic-light dot** derived from live service run state:

- Green — at least one service running
- Amber — services starting or stopping
- Red — at least one service in error
- Grey — all stopped or no services

The **Services** sub-link also shows a count so you can spot empty stacks without opening them.

### Dashboard cards with inline status and per-stack actions

Global dashboard stack cards now show **status chips inline with the stack name** (running, stopped, error, etc.) and expose **Start All**, **Stop All**, and **Update All** in the card footer. Actions use `stopPropagation` so clicking them does not navigate away from the dashboard.

### Slimmer Services table actions

Service rows now expose three actions instead of six:

- **Primary** — context-aware play/stop/retry for the current pipeline stage
- **Logs** — jump to the service logs tab
- **Chevron** — open service details

The service name is a link; double-clicking a row also opens details. Bulk selection still works on single-click.

**Commits behind upstream** moved from the removed Update button to a badge on the **Branch** cell (`N behind`).

### Secret warnings and guided empty state on Services

- **Potential secrets** warnings (previously on stack Overview) now appear above the Services table when detected in service definitions.
- Stacks with **no services** show a **3-step getting-started guide** (Repositories → Prerequisites → Create Services). The old “Run Setup” step was removed — setup is available via bulk actions and the stack menu.

## ♻️ Refactoring

- Removed stack **Overview** (`stack-dashboard.tsx`) and **Setup** (`stack-setup.tsx`) pages; unique concerns relocated to Services, sidebar, and the stack actions menu
- Extracted `StackRedirect`, `StackCard`, `SidebarStackItem`, `ServicesEmptyState`, and `StackActionsMenu` components
- Added `getStackRunSummary()` helper in `stack-status.ts` for shared stack run-state derivation (sidebar dot and future consumers)
- Simplified global `Dashboard` to list-only mode

## 🧪 Tests

- Added unit tests for `getStackRunSummary` and `getStackStatusPaletteKey`
- Added component tests for `StackRedirect`, `StackCard`, `ServiceTable`, `SidebarStackItem`, `ServicesEmptyState`, and `StackActionsMenu`
