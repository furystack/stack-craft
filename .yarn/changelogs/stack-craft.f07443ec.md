<!-- version-type: patch -->
# stack-craft

## ✨ Features

### Navigation restructure — Services-first stack workflow

StackCraft now treats **Services** as the default landing page for every stack. Legacy URLs (`/stacks/:name`, `/stacks/:name/setup`) redirect automatically, and stack-level actions (Edit, Export, Set Up All) are reachable from the Services header menu instead of a separate Overview page.

The sidebar shows a **per-stack status dot** and service count so you can tell at a glance whether a cloned stack still has processes running — useful when the same stack exists in multiple feature branches and port conflicts are a risk.

The global dashboard adds **per-card Start/Stop/Update All** controls alongside inline status chips, without leaving the dashboard.

## 🧪 Tests

- Added `e2e/navigation.spec.ts` covering legacy-route redirects, stack actions menu (Edit/Export), dashboard card actions that do not navigate away, and sidebar status dots
- Updated E2E helpers: `createStack` asserts landing on Services; `deleteStack` reaches Edit Stack via the stack actions menu; sidebar helper drops the removed Overview link
