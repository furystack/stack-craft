<!-- version-type: patch -->
# frontend

## ✨ Features

### "Import as Duplicate" Toggle on the Import Stack Page

Added an "Import as duplicate (generate new IDs)" checkbox below the main directory input on the Import Stack page. When enabled, the request is sent with `regenerateIds: true` and the server assigns fresh UUIDs to every imported service, repository, and prerequisite, remapping inter-entity references accordingly. Use this when importing a copy of a stack that already exists on this machine — without it, the import is rejected with a 409 conflict listing every colliding entity ID.

The checkbox is off by default to preserve the "cross-machine restore with stable IDs" flow.

## 🐛 Bug Fixes

### Adding an Env Variable in `Requirement` Mode No Longer Persists a Custom Value

Adding an environment variable through `EnvironmentVariablesManager` (stack edit page) or `ServiceEnvOverrides` (service detail page) with `Mode: Requirement (creates prerequisite)` previously wrote a `{ source: 'custom', customValue: '…' }` entry into the stack/service config in addition to creating the prerequisite. The variable then appeared with the `Custom` badge after refresh.

`Requirement` mode now ONLY creates the prerequisite. Use the prerequisite row that appears afterwards to pick `Inherit from system` or set a stack/service-level custom value. `Custom only (local)` mode behavior is unchanged.

## ♻️ Refactoring

- `EnvironmentVariablesManager` and `ServiceEnvOverrides` add forms: `Source` select and value input are now hidden when `Mode: Requirement` is selected — the prereq row drives value resolution after creation, so collecting the source/value alongside prereq creation was redundant and confusing.
