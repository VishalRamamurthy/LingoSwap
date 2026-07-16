---
name: ElevenLabs and DeepL setup
description: Which voice IDs work on ElevenLabs free tier, and DeepL free-tier key format/URL.
---

## ElevenLabs

- "Rachel" (21m00Tcm4TlvDq8ikWAM) is a library voice — returns 402 on free plans.
- Working free-tier voices: Brian (nPczCjzI2devNBz1zQrb), Bill (pqHfZKP75CvOlQylNhV4), Daniel (onwK4e9ZLuTAKqWW03F9), Callum (N2lVS1w4EtoT3dr4eOWO), Chris (iP95p4xoKVk53GoZ742B).
- Current default: Brian (nPczCjzI2devNBz1zQrb) in `artifacts/api-server/src/routes/tts.ts`.
- Secret name: `ELEVENLABS_API_KEY`.

**Why:** ElevenLabs moved most named/library voices to paid-only in 2024/2025. Always test a voice ID before shipping.

## DeepL

- Free-tier keys end in `:fx` → use `https://api-free.deepl.com/v2/translate`.
- Pro keys → `https://api.deepl.com/v2/translate`.
- Auth header: `Authorization: DeepL-Auth-Key <key>`.
- Language codes are UPPERCASE (ES, FR, DE, EN…); Norwegian = NB.
- Short inputs (< 5 chars) can return unexpected detected_source_language — not a bug, just DeepL's limitation.
- Secret name: `DEEPL_API_KEY`.
- Translation module: `artifacts/api-server/src/lib/deepl-translate.ts`.
