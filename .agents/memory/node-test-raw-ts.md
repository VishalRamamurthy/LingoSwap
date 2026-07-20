---
name: node --test with raw TypeScript in this monorepo
description: How the root tests/ suite runs .ts files directly on Node 24, and the pitfalls hit setting it up
---

- Root `tests/` has its own `package.json` with `"type": "module"`; run via root script `pnpm test` → `node --test "tests/*.test.ts"` (a bare directory arg fails; use the glob).
- Node 24 type stripping executes `.ts` directly, but relative imports between source files must carry explicit `.ts` extensions. api-server's tsconfig got `"allowImportingTsExtensions": true` + `"noEmit": true` to allow this (safe: its build uses esbuild, not tsc emit).
- Translator package.json has no `"type"` field → Node's module-syntax detection handles its ESM `.ts` files fine when imported from tests.
- **Why:** tests must never hit live APIs; OCR fixtures in `tests/__fixtures__/` were captured once from real OCR.space calls and are mocked ever after.
- **How to apply:** new pure server/client logic that needs tests goes in extension-suffixed-import modules with injected deps; add a `*.test.ts` under root `tests/`.
- curl gotcha when capturing fixtures: `-F "base64Image=data:image/jpeg;base64,…"` breaks because curl parses the `;` as a form option → "Invalid base64 Data URI". Write the data URI to a file and use `-F "base64Image=<file"` (`--form-string` does NOT expand `<file`).
