<!-- version-type: patch -->
# common

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

### Secret Detection Utilities

Added `detectSecretPatterns()` and `detectSecretsInServiceDefinition()` utilities that scan text for patterns commonly indicating hard-coded secrets (passwords, API keys, bearer tokens, private key headers, GitHub tokens, OpenAI-style keys, and high-entropy strings).

**Usage:**

```typescript
import { detectSecretsInServiceDefinition } from 'common'

const warnings = detectSecretsInServiceDefinition({
  files: def.files,
  runCommand: def.runCommand,
  installCommand: def.installCommand,
  buildCommand: def.buildCommand,
})
```

### Tokens API Type Definitions

Added `TokensApi` REST API type definitions for API token management. Tokens are used to authenticate external clients (e.g. MCP) against the StackCraft API.

- `GET /tokens` — list all tokens
- `POST /tokens` — create a new token (returns the plain-text value, shown only once)
- `DELETE /tokens/:id` — delete a token by ID

## 🐛 Bug Fixes
<!-- PLACEHOLDER: Describe the nasty little bugs that has been eradicated (fix:) -->

## 📚 Documentation
<!-- PLACEHOLDER: Describe documentation changes (docs:) -->

## ⚡ Performance
<!-- PLACEHOLDER: Describe performance improvements (perf:) -->

## ♻️ Refactoring

- Replaced legacy `stack-craft-api.ts` exports with the new per-domain API modules from `apis/index.ts`
- Exported `service-path-utils`, `merge-service-view`, and `secret-detector` from the package root

## 🧪 Tests
<!-- PLACEHOLDER: Describe test changes (test:) -->

## 📦 Build
<!-- PLACEHOLDER: Describe build system changes (build:) -->

## 👷 CI
<!-- PLACEHOLDER: Describe CI configuration changes (ci:) -->

## ⬆️ Dependencies
<!-- PLACEHOLDER: Describe dependency updates (deps:) -->

## 🔧 Chores
<!-- PLACEHOLDER: Describe other changes (chore:) -->
