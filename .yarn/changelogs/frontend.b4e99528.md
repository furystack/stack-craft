<!-- version-type: patch -->
# frontend

## 🧪 Tests

- Replaced hard-coded `/tmp/...` paths in the payload-validator specs (`stack-form.spec.ts`, `import-stack.spec.ts`) with `os.tmpdir()`-based equivalents so the frontend `vitest` suite runs unmodified on Windows hosts (where `/tmp` does not exist) in addition to Linux and macOS.
