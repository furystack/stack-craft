<!-- version-type: patch -->
# stack-craft

## ✨ Features

- Added support for importing a stack as a duplicate on the same machine via a new `regenerateIds` flag on `POST /stacks/import` and an "Import as duplicate" checkbox on the Import Stack page. See the `service` and `frontend` changelogs for details.

## ♻️ Refactoring

- Stack export JSON is smaller: the redundant `stackName` field has been removed from every service / repository / prerequisite entry. The value lives once at the top-level `stack.name`. See the `common` changelog for breaking impact on saved export files.

## 🐛 Bug Fixes

- Fixed stack/service env variable add form persisting a phantom `{ source: 'custom' }` entry when `Mode: Requirement` was chosen. See the `frontend` changelog for details.

## ⬆️ Dependencies

### Tooling majors

- `@furystack/eslint-plugin` `^3.0.0` → `^4.0.0`. Removed rule `furystack/no-removed-shade-apis`; the rule is not referenced directly in `eslint.config.js` (only bundled configs are used), so no config change was needed.
- `eslint-plugin-jsdoc` `^62.9.0` → `^63.0.0`. Drops Node 20 support — see 🔧 Chores.
- `lint-staged` `^16.4.0` → `^17.0.5`. Drops Node 20 support and now requires Git ≥ 2.32 (workspace ships with 2.43+, no impact). The optional `yaml` dependency is no longer auto-installed, but `lint-staged` config lives in `package.json`, so this does not affect the project.

### Tooling minors / patches

- `@playwright/test` `^1.59.1` → `^1.60.0`.
- `eslint` `^10.2.1` → `^10.4.0`.
- `typescript-eslint` `^8.59.0` → `^8.59.4`.
- `@vitest/coverage-v8` `^4.1.5` → `^4.1.7`, `vitest` `^4.1.5` → `^4.1.7`, `vite` `^8.0.10` → `^8.0.14`.
- `jsdom` `^29.0.2` → `^29.1.1`.
- `@types/node` `^25.6.0` → `^25.9.1`.
- Yarn release bumped from `yarn-4.14.1.cjs` to `yarn-4.15.0.cjs`.

Per-workspace dependency notes — including the `@furystack/cache` 7 → 8, `@furystack/entity-sync` 2 → 3, `@furystack/entity-sync-client` 3 → 4, and `@furystack/entity-sync-service` 2 → 3 major bumps and their impact assessment — live in the `common`, `frontend`, and `service` changelogs.

## 🔧 Chores

### Node.js 22 LTS is now required for development

`lint-staged@17` and `eslint-plugin-jsdoc@63` both drop Node 20 in this release; `vite@8` already warned about Node 20 below `20.19`. The minimum supported Node version for running scripts (`yarn dev`, `yarn lint`, husky / lint-staged pre-commit hook) is now Node 22.22.1+ (matches `package.json` `engines.node: ">=22.0.0"`).

**Action:** install or switch to Node 22 LTS (e.g. `nvm install 22 && nvm use 22`) before running `yarn install` or any workspace script.
