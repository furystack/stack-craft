<!-- version-type: patch -->
# frontend

## 🐛 Bug Fixes

- Branch selector now shows the underlying error message in the failure notification when loading branches fails, instead of a generic "Failed to load branches" body. The original cause (e.g. network error, server response) is now visible to the user.
- Bulk action bar now filters out services that are already in the target state before issuing requests: `start` skips services already running, and `stop` skips services already stopped. This avoids spurious failures and confusing notifications when a bulk action would have been a no-op for some of the selection.
