<!-- version-type: patch -->
# monaco-mfe

## ✨ Features

- Added Monaco Editor Micro Frontend — a standalone MFE that the host frontend loads at runtime to render code editors
- Exposed `create()` / `destroy()` lifecycle API for mounting and unmounting the editor instance
- Added reactive `props` setter that applies theme, `readOnly`, and `value` changes without remounting the editor
- Added JSON schema validation support via `registerSchema()` for in-editor diagnostics
- Added runtime theme support with `applyTheme()`, accepting theme data from the host application

## 📦 Build

- Configured Vite library build outputting a single ES module (`dist/index.js`) with source maps
- Configured Monaco web workers for JSON language support via dynamic `import()` with Vite worker plugins
