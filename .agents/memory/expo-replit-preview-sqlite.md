---
name: Expo Replit preview SQLite sync error
description: How to fix the "Failed to initialize SQLite persistence" overlay that blocks Expo SDK 54 web previews inside Replit's iframe.
---

Expo SDK 54's dev-mode web preview tries to use the browser's Origin Private File System (OPFS) for dev-tools sync. Replit's preview iframe does not expose this API, so the web preview shows a **"Failed to connect: sync error: Failed to initialize SQLite persistence"** overlay and the app may not render.

**Why:** The dev client overlay is bundled with the dev-mode web app; it is not a separate server. The SQLite persistence layer is required by that overlay, and it fails in the iframe before the app can mount.

**How to apply:**

- For the Replit preview, run `expo start` with the `--no-dev` flag. This removes the dev-tools overlay and the SQLite dependency from the web bundle, so the app renders in the iframe.
- Keep the same port/host/env variables as the normal dev command.
- Trade-off: Hot Module Reloading is disabled in this mode. To see code changes, reload the preview manually.
- Alternative: view the app on a physical device by scanning the Expo Go QR code, which does not use the iframe and keeps full dev features.

Example change:

```json
"dev": "EXPO_PACKAGER_PROXY_URL=https://$REPLIT_EXPO_DEV_DOMAIN EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN EXPO_PUBLIC_REPL_ID=$REPL_ID REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN pnpm exec expo start --localhost --no-dev --port $PORT"
```
