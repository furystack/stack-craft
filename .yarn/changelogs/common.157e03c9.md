<!-- version-type: patch -->
# common

## ✨ Features

- Added optional `regenerateIds` flag to the `POST /stacks/import` request body (`ImportStackEndpoint`). When set to `true`, the server assigns fresh UUIDs to every service, repository, and prerequisite during import and remaps cross-entity references (`prerequisiteIds`, `prerequisiteServiceIds`, and the `config.services` map). Use this to duplicate a stack on the same machine without ID collisions with the source stack.

## 💥 Breaking Changes

### Stack Export Format No Longer Includes `stackName` on Child Entities

`ShareableServiceDefinition`, `ShareableGitHubRepository`, and `ShareablePrerequisite` no longer carry a `stackName` field. The value is always equal to the top-level `stack.name` and was pure duplication on the wire — for a stack with N services + M repos + P prereqs the export emitted N+M+P copies of the same string.

**Impact:**

- Stack JSON files exported by older versions cannot be re-imported without first removing the `stackName` field from each service / repository / prerequisite entry. The import action validates the request body against the JSON schema, which now rejects extra properties.
- Tools or scripts that constructed an import payload programmatically and set `stackName` on child entities need to drop that field.

**Migration:** strip the `stackName` field from every entry under `services[]`, `repositories[]`, and `prerequisites[]` in any saved export JSON. The top-level `stack.name` already carries the value.
