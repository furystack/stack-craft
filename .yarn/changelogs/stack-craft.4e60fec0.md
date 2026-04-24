<!-- version-type: patch -->
# stack-craft

## 📦 Build

### TypeScript Project References

Root `tsconfig.json` is now a solution file that references the `common`, `service`, and `frontend` sub-projects (`files: []`, `references: [...]`). Removed the top-level `incremental` and `composite` options (they now live in each sub-project).

### Lint Coverage for Non-Compiled Files

Added `tsconfig.lint.json` (extends the root `tsconfig.json` with `noEmit: true`) to include e2e specs, Vite configs, and other `*.config.{ts,mts,mjs}` files in the ESLint `parserOptions.project` list. ESLint now runs with the full set of per-package tsconfigs plus the new lint config:

```js
parserOptions: {
  project: [
    'common/tsconfig.json',
    'service/tsconfig.json',
    'frontend/tsconfig.json',
    'monaco-mfe/tsconfig.json',
    'tsconfig.lint.json',
  ],
}
```

Expanded the ESLint ignore list to cover compiled config and e2e artifacts emitted next to sources (`**/*.config.{js,mjs,d.ts,d.mts}`, source maps, `e2e/**/*.{js,d.ts,js.map}`).

## 📚 Documentation

- Updated the `REST_SERVICE.mdc` Cursor rule

## ⬆️ Dependencies

- Bumped `@furystack/eslint-plugin` from `^2.1.5` to `^2.2.0`
- Bumped `vite` from `^8.0.9` to `^8.0.10`
- Bumped `vitest` / `@vitest/coverage-v8` from `^4.1.4` to `^4.1.5`
