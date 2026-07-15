# Translator

A mobile app that auto-detects the language of any text and translates it into a language of your choice.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

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

- Translation runs server-side through the Replit AI Integrations OpenAI proxy (gpt-5.4-mini, JSON response mode) — no user API key needed
- Translation history is stored on-device with AsyncStorage; no database is provisioned
- Auto-detect is the default; passing `sourceLanguage` skips detection and echoes it back

## Product

- Type/paste text, auto-detect its language, translate to a chosen target language
- Manual source-language override, copy-to-clipboard, on-device history with restore/delete/clear

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
