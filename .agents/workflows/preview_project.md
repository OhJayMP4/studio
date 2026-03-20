---
description: Preview the Next.js Project
---
# Preview Project Workflow

This workflow starts the Next.js development server for web preview.

1. Ensure you are in the project root: `c:\Users\User\Downloads\download`
2. Start the development server (Note: use `npm run dev` for default Next.js dev server, or the specific command from `.idx/dev.nix`):
```bash
// turbo
npm run dev -- --port 3000 --hostname 0.0.0.0
```

3. Once the server starts correctly, you can open `http://localhost:3000` in the Antigravity preview browser to view the app.
