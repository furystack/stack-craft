<!-- version-type: patch -->
# service

## ⬆️ Dependencies

- Bumped `typescript` from `^5.9.3` to `^6.0.3`.

## 📦 Build

- Added explicit `"types": ["node"]` to `tsconfig.json` so Node globals resolve correctly under TypeScript 6.

## ♻️ Refactoring

- Removed the `as StackView` cast from the stacks REST API handler in `setup-stacks-rest-api.ts`; the mapped entry is now typed directly.
- Dropped the `as Partial<ApiToken>` cast on the `lastUsedAt` update in `bearer-token-auth.ts`.

## 🧪 Tests

- Cleaned up redundant `as StackConfig`, `as ServiceConfig`, `as ServiceDefinition` and `as Prerequisite` casts across the service test suite (including `service-env-resolver`, `encrypt-existing-secrets`, `get-service-or-throw`, `resolve-service-cwd`, git/service lifecycle specs and the stacks/tokens REST specs) now that TypeScript 6 infers the correct type from the object literals.
