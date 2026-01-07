# Backend (Node.js)

This folder contains a minimal Node.js project intended for push notifications using `expo-server-sdk` (no push code included yet).

## Quick start

- Node.js 18+ recommended
- Installed deps: `expo-server-sdk`

### Run a quick sanity check

```bash
node index.js
```

You should see:

```
Backend ready. Add your server logic here.
```

### Add your logic

- Implement your push logic in a new file (e.g. `push.js`) and require it from `index.js` when ready.
- Keep secrets (e.g., service credentials) in environment variables or a `.env` file (ignored by git).

## Notes

- This project is intentionally minimal; add a web framework (Express/Fastify) only if you need an HTTP API here.
- If you already have an API in `api_backend` (Django), prefer keeping this push service separate and call it asynchronously or via a queue.
