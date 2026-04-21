<!-- version-type: patch -->
# stack-craft

## ⬆️ Dependencies

- Bumped `typescript` from `^5.9.3` to `^6.0.3` across the workspace.
- Bumped `typescript-eslint` from `^8.58.2` to `^8.59.0`.
- Bumped `eslint` from `^10.2.0` to `^10.2.1`.
- Bumped `vite` from `^8.0.8` to `^8.0.9`.

## 📦 Build

- Updated root `tsconfig.json` `target` from `ES2022` to `ESNext` to match the TypeScript 6 toolchain.

## 🔧 Chores

- Normalised `typescript.tsdk` in `.vscode/settings.json` to use a POSIX path (`node_modules/typescript/lib`) so the TypeScript SDK resolves on non-Windows hosts.
