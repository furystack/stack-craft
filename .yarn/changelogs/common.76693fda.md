<!-- version-type: patch -->
# common

## ♻️ Refactoring

- Normalized service relations — extracted `prerequisiteIds` and `prerequisiteServiceIds` from `ServiceDefinition` into dedicated `ServiceDependencyLink` and `ServicePrerequisiteLink` join entities
- Added `ServiceRelations` type to `ServiceView`, separating relational data from entity definitions
- Added `mergeServiceView()` utility for composing a `ServiceView` from separate data-store entities with sensible defaults for missing pieces

## 📚 Documentation

- Added JSDoc to all API endpoint definitions across all API modules (identity, services, stacks, system, prerequisites, tokens, github-repositories, install)

## 🧪 Tests

- Added unit tests for `mergeServiceView()` covering full views, partial data, and missing relations

## 📦 Build

- Regenerated JSON schemas to reflect normalized model structure
