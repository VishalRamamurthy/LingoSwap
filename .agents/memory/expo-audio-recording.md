---
name: expo-av audio recording pattern
description: How to record audio in Expo Go and send to a backend for server-side STT.
---

# Expo audio recording → server-side STT

Use `expo-av` (Audio.Recording) for recording in Expo Go. After stopping, use `expo-file-system` (FileSystem.readAsStringAsync with EncodingType.Base64) to read the recording URI as base64, then send to the backend as JSON.

**Why:** Expo Go cannot run native STT directly. Sending base64 audio to the API server and using OpenAI Whisper (via `speechToText` from `@workspace/integrations-openai-ai-server/audio`) is the right pattern.

**How to apply:**
- `expo-av` records to a file URI on both iOS and Android in m4a/mp4 format.
- `speechToText(buffer)` from the audio integration module accepts a Buffer — do NOT pass "m4a" as the format arg (type only accepts "wav"|"mp3"|"webm"|undefined); passing undefined lets it auto-detect.
- Set `express.json({ limit: "20mb" })` on the API server to handle base64 audio bodies.
- Pin `expo-file-system` to `~19.0.23` for SDK 54 compatibility.
- `expo-av` shows a deprecation warning in SDK 54 but still works; migration to `expo-audio` is future work.
