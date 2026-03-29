<!-- version-type: minor -->
# frontend

## ✨ Features

### Nested Routing System

Implemented a full nested routing system with typed navigation helpers (`StackCraftNestedRouteLink`, `stackCraftNavigate`) and URL-driven breadcrumb navigation. All routes are scoped under stacks for contextual navigation.

### Dashboard

Stack overview page displaying all stacks with entity-sync–powered live updates. Selecting a stack shows its services, status, and quick actions.

### Service Management

- **Services list** with pipeline status indicators (clone → install → build → run) and bulk actions
- **Service detail page** with pipeline stepper, log viewer, branch selector, environment overrides, prerequisite status, and lifecycle controls (start/stop/restart/install/build/pull/setup/update)
- **Service logs** with ANSI color rendering, per-process filtering, and log clearing
- **Create service wizard** with two-step flow: define service then optional automated setup

### Stack Management

- **Create/edit stack** with name, display name, main directory, and markdown description
- **Stack import/export** for portability between environments with environment variable remapping
- **Stack setup** progress page showing clone/install/build readiness per service

### Repository Management

- **Repository list/create/edit** pages for managing linked GitHub repositories with URL validation

### Prerequisites Management

- **Prerequisites list** with check status display and typed creation form supporting Node.js, Yarn, .NET SDK, NuGet feeds, environment variables, and custom scripts

### User Settings

- Theme selection with persistent storage
- Password change form
- API token management (create, list, delete)

### Installer Wizard

Full-screen first-run wizard with prerequisite checks, admin user creation, and success confirmation — shown automatically when the backend reports an uninstalled state.

### Layout and Navigation

- **Sidebar** with collapsible per-stack navigation sections (services, repositories, prerequisites, import/export)
- **Header** with breadcrumbs, theme toggle, and logout
- **Entity sync** via WebSocket (`/api/ws`) for real-time collection updates across all views

### UI Components

- `ServicePipelineStepper` / `MiniPipelineDots` — visualize clone/install/build/run stages with color-coded status
- `BranchSelector` — Git branch switching with remote branch listing
- `EnvironmentVariablesManager` — stack-level env var editing with secret masking and availability checks
- `ServiceEnvOverrides` — per-service environment variable override editing
- `LogViewer` / `LogLine` — streaming log display with ANSI escape sequence rendering
- `PrerequisiteTable` / `PrerequisiteList` — prerequisite display with check status chips
- `ServiceTable` / `RepositoryTable` — data tables with status indicators and actions
- `StatusChips` — colored status badges for pipeline stages and prerequisite types

### Utilities

- `parseAnsi()` — parses ANSI escape sequences into styled segments for terminal log rendering
- `getServicePipelineStages()` / `getServicePrimaryAction()` — derive pipeline visualization data and contextual actions from service state
- `applyClientFindOptions()` — client-side `FindOptions` filtering, ordering, and pagination

### Per-API REST Clients

Replaced monolithic `StackCraftApiClient` with individual typed clients: `IdentityApiClient`, `StacksApiClient`, `ServicesApiClient`, `GitHubReposApiClient`, `PrerequisitesApiClient`, `TokensApiClient`, `SystemApiClient`, `InstallApiClient`.

## ♻️ Refactoring

- Restructured app shell into `Header` + `Sidebar` + `Body` layout with auth/install gating
- Replaced `StackCraftApiClient` and `BoilerplateApiClient` with per-domain API clients
- Session service now uses `IdentityApiClient` with full `User` type and `[Symbol.dispose]` cleanup

## 🧪 Tests

- Added unit tests for ANSI escape sequence parser (`parse-ansi.spec.ts`)
- Added unit tests for service pipeline stage derivation and action mapping (`service-pipeline.spec.ts`)

## 📦 Build

- Migrated to Vite 8 with synchronous `defineConfig`

## ⬆️ Dependencies

- Added `@furystack/cache`, `@furystack/entity-sync`, `@furystack/entity-sync-client` for live data sync
- Bumped Vite to v8, Vitest to v4
