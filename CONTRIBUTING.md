# Contributing to StackCraft

## Development Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/furystack/stack-craft.git
cd stack-craft
yarn
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create your environment file:

```bash
cp .env.example .env
```

4. Start the backend and frontend in separate terminals:

```bash
yarn start:service   # Terminal 1
yarn start:frontend  # Terminal 2
```

## Project Structure

```
stack-craft/
├── common/     # Shared API type definitions, models, and generated schemas
├── frontend/   # Shades-based SPA (Vite dev server on :8080)
├── service/    # FuryStack REST backend (Node.js on :9090)
├── e2e/        # Playwright end-to-end tests
└── docs/       # Documentation
```

## Code Style

The project uses **ESLint** and **Prettier** for code quality and formatting. Both run automatically on staged files via Husky pre-commit hooks.

```bash
yarn lint          # Run ESLint
yarn format        # Format all files with Prettier
yarn format:check  # Check formatting without modifying files
```

Key conventions:

- **File names:** kebab-case (e.g. `service-pipeline.ts`)
- **Components:** PascalCase exports in kebab-case files
- **Types:** Prefer `type` over `interface`
- **No `any`:** Use `unknown`, generics, or union types instead

See `.cursor/rules/` for detailed coding guidelines.

## Testing

```bash
yarn test          # Run Vitest unit tests with coverage
yarn test:e2e      # Run Playwright E2E tests (requires running DB)
```

- Unit tests are co-located with source files (`*.spec.ts`)
- Coverage thresholds are enforced in `vitest.config.mts`
- Add tests for new functionality before submitting a PR

## Schema Generation

When you modify API types in `common/src/apis/` or models in `common/src/models/`, regenerate the JSON schemas:

```bash
yarn build           # Must build common first
yarn create-schemas  # Regenerate schemas
```

## Versioning and Changelogs

This project uses [Yarn's release workflow](https://yarnpkg.com/features/release-workflow) for version management and changelogs. Both are required before opening a PR.

### 1. Bump versions

Decide which packages need a version bump and at what level (patch/minor/major):

```bash
yarn bumpVersions          # Interactive prompt to select packages and bump type
```

This creates version manifest files that Yarn tracks. You can verify the state with:

```bash
yarn version check         # Validates that version bumps are configured
```

### 2. Create changelog drafts

Generate changelog draft files for each bumped package:

```bash
yarn changelog create      # Creates .yarn/changelogs/{package}.{id}.md files
yarn changelog create -f   # Force-recreate (useful if drafts are stale)
```

### 3. Fill the changelog entries

Edit the generated `.yarn/changelogs/*.md` files. Each file has section placeholders -- fill in the relevant ones describing what changed and why. Write for end users, not as a git log.

### 4. Validate

```bash
yarn changelog check       # Validates entries are filled and match the version type
```

### Applying releases (maintainers only)

When merging to a release branch, the release pipeline runs:

```bash
yarn applyReleaseChanges   # Applies version bumps, merges changelogs, and formats
```

## Pull Request Process

1. Create a feature branch from the latest `develop`
2. Make your changes with tests
3. Ensure `yarn build`, `yarn lint`, and `yarn test` all pass
4. Bump versions (`yarn bumpVersions`) and fill changelog entries (`yarn changelog create`, then edit the drafts)
5. Verify with `yarn changelog check`
6. Open a PR against `develop`
7. PRs must pass CI checks (build, lint, test, E2E, changelog check, version check)
