---
name: api-zod barrel conflict
description: orval split-mode regenerates lib/api-zod/src/index.ts; schema names that match operationId-derived names cause duplicate export TS errors.
---

# orval zod barrel — duplicate export conflict

Orval in `split` mode generates `lib/api-zod/src/index.ts` as a barrel that re-exports both `./generated/api` (Zod schemas) and `./generated/types` (TypeScript interfaces). When a component schema name matches the operationId-derived response schema name (e.g. schema `VoiceTranslateResponse` + operationId `voiceTranslate` → both produce `VoiceTranslateResponse`), TypeScript raises `TS2308: Module has already exported a member`.

**Why:** Orval derives Zod schema names as `<PascalCaseOperationId>Response` and TypeScript interface names directly from the component schema name. When these coincide, both barrel re-exports collide.

**How to apply:** When adding a new operation, check if the component schema name for its response would match `<PascalCaseOperationId>Response`. If so, rename the component schema (e.g. append `Output` → `VoiceTranslateOutput`) to break the tie. The generated TypeScript interface will then have the unique name, and the Zod schema keeps the operationId-derived name.
