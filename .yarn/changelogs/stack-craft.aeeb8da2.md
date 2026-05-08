<!-- version-type: patch -->
# stack-craft

## 🐛 Bug Fixes

- Patch release rolling up minor usability fixes across `frontend` and `service`: branch selector surfaces real error messages, bulk actions skip services already in the target state, the branches endpoint stays responsive during pulls/refreshes, and the "commits behind origin" badge updates immediately after pulls and external HEAD changes instead of waiting for the next periodic fetch. See the `frontend` and `service` changelogs for details.
