<!-- version-type: patch -->
# frontend

## 🐛 Bug Fixes

- Fixed service URL resolution from `.env` file configuration
- Fixed service selection behavior in the services list

## ♻️ Refactoring

- Restructured layout components into `layout/` module (`sidebar`, `breadcrumbs`, `header`, `body`, `layout`) with barrel export
- Split monolithic `service-form.tsx` into focused subcomponents: `dependency-selector`, `prerequisite-selector`, and `file-list`
- Decomposed `service-detail.tsx` into a tabbed interface module with dedicated tabs (overview, configuration, logs, history) and an action bar
- Refactored dashboard into stack-oriented views (`stack-dashboard`, `stack-list-dashboard`, `service-row`)
- Split create-service wizard into `index.tsx` and `setup-step.tsx`
- Moved shared components (`github-logo`, `log-line`, `log-viewer`) into `shared/` module
- Removed standalone theme-switch component — theme selection moved to the settings page
- Refactored branch-selector component for positioning and scroll behavior

## 🧪 Tests

- Added unit tests for `session`, `theme-registry`, `install-service`, `environment-variable-service`, and `apply-client-find-options`
- Added form tests for `github-repo-form`, `prerequisite-form`, `stack-form`, `service-form/validators`, `create-admin-step`, `import-stack`, `api-tokens-section`, and `password-change-form`
