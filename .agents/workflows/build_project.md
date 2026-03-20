---
description: Build the Next.js Project
---
# Build Project Workflow

This workflow installs project dependencies and builds the Next.js project.

1. Ensure you are in the project root: `c:\Users\User\Downloads\download`
2. Install dependencies:
```bash
npm install
```

3. Typecheck the project:
```bash
npm run typecheck
```
*Note: Typechecking currently has some errors in Firebase functions that might need resolving.*

4. Build the Next.js Web App:
```bash
// turbo
npm run build
```
