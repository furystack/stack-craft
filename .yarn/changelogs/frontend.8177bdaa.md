<!-- version-type: patch -->
# frontend

## ⬆️ Dependencies

- Bumped `typescript` from `^5.9.3` to `^6.0.3`.
- Bumped `vite` from `^8.0.8` to `^8.0.9`.

## 📦 Build

- Updated `tsconfig.json` `target` from `ES2022` to `ESNext` to align with the TypeScript 6 toolchain.
- Added explicit `"types": ["vitest/globals", "node"]` to `tsconfig.json` so Vitest and Node globals are picked up without implicit discovery.

## ♻️ Refactoring

- Removed redundant `as PrerequisiteConfig` casts from `buildConfig()` in `prerequisite-form.tsx` — inference from the discriminated union now produces the correct type directly.
- Dropped the `as Record<string, 0 | 1>` cast when initialising `remountPhaseByStack` in `sidebar.tsx`.
- Replaced the manual `findOptions.order as Record<string, 'ASC' | 'DESC'>` cast in `service-table.tsx` with a destructured `order` read.

## 🧪 Tests

- Removed unnecessary `as unknown as <Api>Client` casts from `setExplicitInstance` calls in `utils.spec.ts`, `environment-variable-service.spec.ts`, `install-service.spec.ts` and `session.spec.ts`; typed mocks are now accepted directly.
