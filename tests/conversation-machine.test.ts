import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IDLE_STATE,
  transition,
  type ConversationState,
} from "../artifacts/translator/lib/conversation-machine.ts";

const recording: ConversationState = { phase: "recording", activeSide: "top" };
const transcribing: ConversationState = { phase: "transcribing", activeSide: "top" };
const translating: ConversationState = { phase: "translating", activeSide: "top" };
const speaking: ConversationState = { phase: "speaking", activeSide: "top" };

test("happy path: idle → recording → transcribing → translating → speaking → idle", () => {
  let s: ConversationState | null = IDLE_STATE;
  s = transition(s!, { type: "START_RECORDING", side: "top" });
  assert.deepEqual(s, recording);
  s = transition(s!, { type: "STOP_RECORDING" });
  assert.deepEqual(s, transcribing);
  s = transition(s!, { type: "TRANSCRIBED" });
  assert.deepEqual(s, translating);
  s = transition(s!, { type: "TRANSLATED" });
  assert.deepEqual(s, speaking);
  s = transition(s!, { type: "SPOKEN" });
  assert.deepEqual(s, IDLE_STATE);
});

test("double-tap guard: START_RECORDING is illegal while already recording", () => {
  assert.equal(transition(recording, { type: "START_RECORDING", side: "top" }), null);
  assert.equal(transition(recording, { type: "START_RECORDING", side: "bottom" }), null);
});

test("cannot start recording while transcribing/translating/speaking", () => {
  for (const s of [transcribing, translating, speaking]) {
    assert.equal(transition(s, { type: "START_RECORDING", side: "bottom" }), null);
  }
});

test("STOP_RECORDING only legal while recording", () => {
  for (const s of [IDLE_STATE, transcribing, translating, speaking]) {
    assert.equal(transition(s, { type: "STOP_RECORDING" }), null);
  }
});

test("pipeline events are phase-locked", () => {
  assert.equal(transition(IDLE_STATE, { type: "TRANSCRIBED" }), null);
  assert.equal(transition(recording, { type: "TRANSLATED" }), null);
  assert.equal(transition(transcribing, { type: "SPOKEN" }), null);
});

test("ERROR and CANCEL abort to idle from any phase", () => {
  for (const s of [IDLE_STATE, recording, transcribing, translating, speaking]) {
    assert.deepEqual(transition(s, { type: "ERROR" }), IDLE_STATE);
    assert.deepEqual(transition(s, { type: "CANCEL" }), IDLE_STATE);
  }
});
