<!-- version-type: patch -->
# service

## 🐛 Bug Fixes

- `ServiceBranchesAction` (`GET /services/:id/branches`) now succeeds while a pull or refresh is in flight on an already-cloned repository. Previously the endpoint rejected with `400 Repository is not cloned yet` whenever `cloneStatus` was `cloning`, even though the working copy and `.git` directory already existed. The check now also accepts `cloning` as long as a `.git` directory is present on disk, so the branch list stays available during background fetches. Initial clones (no `.git` yet) still return `400` as before.
- `GitHeadWatcher` now refreshes `commitsBehind` whenever it detects an external HEAD or ref change, so the "behind origin" badge reflects the new branch state immediately instead of staying stuck on the previous value until the next periodic fetch.
- A successful `git pull` now writes `commitsBehind: 0` alongside clearing `lastPullError`. Previously the local git status patch only cleared the error, and the badge could remain stale for up to 5 minutes (until the next `GitWatcher` tick) because `GitHeadWatcher` is re-attached with `ignoreInitial: true` after the pull and misses the writes that just happened.

## 🧪 Tests

- Added `ServiceBranchesAction` test cases for the `cloneStatus: 'cloning'` state covering both branches of the new behavior: returns branches when `.git` already exists (mid-pull / refresh) and still throws `400` during an initial clone before `.git` is created.
