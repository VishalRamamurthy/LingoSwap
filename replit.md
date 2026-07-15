# Translator

A mobile app that auto-detects the language of any text and translates it into a language of your choice.

## Run & Operate

- `pnpm install` — install dependencies after import or checkout
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/translator run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` for translation

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/translator/` — Expo mobile app (translate + history screens, tabs)
- `artifacts/api-server/src/routes/translate.ts` — POST /api/translate endpoint
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/integrations-openai-ai-server/` — OpenAI client via Replit AI Integrations proxy
- `artifacts/translator/contexts/HistoryContext.tsx` — AsyncStorage-backed history
- `artifacts/translator/constants/colors.ts` — theme tokens

## Architecture decisions

- Translation runs server-side through the OpenAI API using the configured API key (gpt-5.4-mini, JSON response mode)
- Translation history is stored on-device with AsyncStorage; no database is provisioned
- Auto-detect is the default; passing `sourceLanguage` skips detection and echoes it back

## Product

- Type/paste text, auto-detect its language, translate to a chosen target language
- Manual source-language override, copy-to-clipboard, on-device history with restore/delete/clear

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Run workflows after `pnpm install`:** Workflows fail with "command not found" until dependencies are installed.
- **OpenAI API key:** The API key must be valid and have usable credits. If translation fails with `HTTP 502`, check the API server logs for the underlying OpenAI error (e.g., 401 invalid key or 429 insufficient quota).
- **Expo FileSystem types:** The app uses the legacy `readAsStringAsync` API with string encoding constants because the newer `File` class API is not available in all Expo builds.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
