<!-- version-type: minor -->
# stack-craft

## ✨ Features

- Added PostgreSQL via `docker-compose.yml` for local development (port 5433, `postgres:17-alpine`)
- Added `.env.example` with `DATABASE_URL` configuration for quick setup
- Added separate E2E test suites: installer flow (`test:e2e:install`), smoke tests (`smoke.spec.ts`), and dogfooding tests (`dogfooding.spec.ts`) covering real repository clone/install/build/run

## ♻️ Refactoring

- Renamed `test:unit` script to `test` for simplicity
- Split E2E tests into focused scenarios (installer, smoke, dogfooding) replacing the single `page.spec.ts`

## 👷 CI

- Added PostgreSQL service container to the `ui-tests` workflow with health checks
- Separated installer E2E (`test:e2e:install`) from app E2E in the CI pipeline
- Moved heavy Playwright tests from `build-test` to `ui-tests` workflow to keep the default build fast

## 📚 Documentation

- Updated README with PostgreSQL setup instructions, Docker run example with `DATABASE_URL`, and revised testing commands

## 📦 Build

- Upgraded to Yarn 4.13.0
- Upgraded ESLint to v10 with `@furystack/eslint-plugin` (replacing `eslint-plugin-playwright`)
- Upgraded Vite to v8, Vitest to v4, `@playwright/test` to v1.58

## ⬆️ Dependencies

- Added `jsdom` for Vitest browser environment
- Bumped `typescript-eslint`, `lint-staged`, `rimraf`, `@types/node`
