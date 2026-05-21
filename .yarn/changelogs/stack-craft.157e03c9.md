<!-- version-type: patch -->
# stack-craft

## ✨ Features

- Added support for importing a stack as a duplicate on the same machine via a new `regenerateIds` flag on `POST /stacks/import` and an "Import as duplicate" checkbox on the Import Stack page. See the `service` and `frontend` changelogs for details.

## ♻️ Refactoring

- Stack export JSON is smaller: the redundant `stackName` field has been removed from every service / repository / prerequisite entry. The value lives once at the top-level `stack.name`. See the `common` changelog for breaking impact on saved export files.

## 🐛 Bug Fixes

- Fixed stack/service env variable add form persisting a phantom `{ source: 'custom' }` entry when `Mode: Requirement` was chosen. See the `frontend` changelog for details.
