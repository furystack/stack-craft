<!-- version-type: patch -->
# stack-craft

<!--
FORMATTING GUIDE:

### Detailed Entry (appears first when merging)

Use h3 (###) and below for detailed entries with paragraphs, code examples, and lists.

### Simple List Items

- Simple changes can be added as list items
- They are collected together at the bottom of each section

TIP: When multiple changelog drafts are merged, heading-based entries
appear before simple list items within each section.
-->

## 📦 Build

- Integrated ESLint into the workspace with `eslint.config.js` and added `lint` script for `*.{ts,tsx}` files
- Added `lint-staged` pre-commit hook running ESLint fix, Prettier write, and git add on staged TypeScript files

## ⬆️ Dependencies

- Upgraded Yarn from 4.12.0 to 4.13.0

## 🔧 Chores

- Updated `.gitignore` to exclude data storage directories and MCP-related files
