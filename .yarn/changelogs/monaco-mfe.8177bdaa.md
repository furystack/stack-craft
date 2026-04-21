<!-- version-type: patch -->
# monaco-mfe

## ⬆️ Dependencies

- Bumped `typescript` from `^5.9.3` to `^6.0.3`.
- Bumped `vite` from `^8.0.8` to `^8.0.9`.

## 📦 Build

- Updated `tsconfig.json` `lib` entries from `ES2021` to `ES2023` to match the TypeScript 6 defaults.

## ♻️ Refactoring

- Removed the `as editorTypes.IStandaloneThemeData` cast in `applyTheme()` — the `MonacoThemeData` type now satisfies Monaco's expected shape without assertion.
