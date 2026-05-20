<!-- version-type: patch -->
# stack-craft

## 🧪 Tests

- Replaced hard-coded `/tmp/...` paths in Playwright E2E specs (`e2e/smoke.spec.ts`, `e2e/dogfooding.spec.ts`) and the frontend payload-validator specs (`stack-form.spec.ts`, `import-stack.spec.ts`) with `os.tmpdir()`-based paths so the suite runs unmodified on Windows hosts (where `/tmp` does not exist) in addition to Linux and macOS.
