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

### Dashboard and Stack Management

- Added dashboard page with stack overview, service status, and quick actions for service lifecycle management
- Added stack creation, editing, and setup pages with service/repository/prerequisite configuration
- Added sidebar navigation with live stack list from entity sync and active route highlighting

### Service Management

- Added service detail page with lifecycle controls (start, stop, restart, install, build, pull, setup, update), environment variable overrides, and state history timeline
- Added service creation page and multi-step create-service wizard with stack selection, repository linking, and environment variable configuration
- Added real-time log viewer with ANSI color rendering, stderr highlighting, and text search filtering

### Repository and Prerequisite Management

- Added GitHub repository create/edit pages with URL validation
- Added prerequisite table with dependency check status and re-check actions
- Added prerequisite list for the installer flow

### User Settings

- Added user settings page with API token management (create, list, revoke), password change form, and theme selector
- Added theme registry with multiple lazy-loaded themes and persistence via local storage

### Import/Export

- Added stack export to portable JSON format
- Added stack import with configurable `mainDirectory`, per-service environment variable overrides, and conflict detection

### Installer Wizard

- Added first-run installer with step-by-step flow: welcome, prerequisite checks, admin account creation, and success confirmation

### Real-Time Updates

- Added WebSocket service with automatic reconnection and exponential backoff for receiving `service-status-changed`, `git-branches-changed`, and `dependency-check-result` events
- Integrated entity sync via WebSocket for live data updates across all views

### UI Components

- Added reusable entity forms for stacks, services, repositories, and prerequisites
- Added environment variables manager with add/edit/delete and masked secret display
- Added service status indicator, status chips, and service/repository/prerequisite tables
- Added wizard step component and log line renderer with ANSI parsing

### API Clients

- Added per-domain API client services: `ServicesApiClient`, `StacksApiClient`, `GithubReposApiClient`, `PrerequisitesApiClient`, `TokensApiClient`, `IdentityApiClient`, `InstallApiClient`, `SystemApiClient`

## 🐛 Bug Fixes

- Fixed GitHub repository in-memory search not matching partial queries
- Fixed navigation not updating correctly on programmatic route changes
- Fixed service form validation and submission errors
- Fixed token list rendering when no tokens exist

## ♻️ Refactoring

- Replaced single `BoilerplateApiClient` / `StackCraftApiClient` with modular per-domain API clients
- Consolidated duplicated form components into shared entity form patterns
- Redesigned login page layout and styling
- Restructured page routing in `Body` component for the new page hierarchy

## 🧪 Tests

- Added unit tests for ANSI escape sequence parsing in `parse-ansi.spec.ts`
