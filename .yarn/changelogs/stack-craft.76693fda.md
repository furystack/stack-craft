<!-- version-type: patch -->
# stack-craft

## 📚 Documentation

- Added troubleshooting guide covering database connectivity, port conflicts, and environment configuration issues
- Added `CONTRIBUTING.md` with development workflow and contribution guidelines
- Added `CODE_OF_CONDUCT.md` with Contributor Covenant
- Added `SECURITY.md` with vulnerability reporting procedures
- Added `.env.example` with documented environment variable defaults
- Expanded `README.md` with architecture overview and getting-started instructions

## 🧪 Tests

- Expanded E2E dogfooding test suite with prerequisite, repository, and service management flows
- Split E2E helpers into domain-specific modules (`login`, `notification`, `prerequisite`, `repository`, `service`, `sidebar`, `stack`)
- Refactored smoke tests for updated routing and layout structure
