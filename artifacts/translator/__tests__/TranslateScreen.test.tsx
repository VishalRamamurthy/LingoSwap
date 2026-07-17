/**
 * UI test: verifies the two-phase voice translation UI.
 *
 * Phase 1 – transcription done, translation in-flight:
 *   The result card shows the spoken text alongside a "..." placeholder while
 *   the translate mutation is still pending.
 *
 * Phase 2 – translation resolves:
 *   The "..." is replaced by the translated text.
 *
 * Uses react-test-renderer directly to avoid the @testing-library/react-native
 * version pinning that conflicts with react-test-renderer at React 19.1.
 */

import React from "react";
import renderer, { act } from "react-test-renderer";
import TranslateScreen from "../app/(tabs)/index";

// ---------------------------------------------------------------------------
// Mutable mock state — variables MUST be prefixed with "mock" so Babel's
// jest.mock hoisting guard allows them inside factory functions.
// ---------------------------------------------------------------------------

let mockTranslateIsPending = false;
let mockTranslateIsError = false;
let mockTranslateMutateInner: jest.Mock = jest.fn();
let mockTranscribeMutateInner: jest.Mock = jest.fn();

function resetMockState() {
  mockTranslateIsPending = false;
  mockTranslateIsError = false;
  mockTranslateMutateInner = jest.fn();
  mockTranscribeMutateInner = jest.fn();
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("@workspace/api-client-react", () => ({
  useTranslateText: () => ({
    mutate: (...args: any[]) => mockTranslateMutateInner(...args),
    isPending: mockTranslateIsPending,
    isError: mockTranslateIsError,
    error: null,
    reset: jest.fn(),
  }),
  useTranscribeAudio: () => ({
    mutate: (...args: any[]) => mockTranscribeMutateInner(...args),
    isPending: false,
    isError: false,
    error: null,
    reset: jest.fn(),
  }),
}));

// Expo Router ----------------------------------------------------------------
let mockRouterParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouterParams,
  useRouter: () => ({ setParams: jest.fn() }),
}));

// Native / Expo modules ------------------------------------------------------
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Lowest: 1 },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

jest.mock("expo-file-system", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("base64data"),
}));

// Workspace / internal -------------------------------------------------------
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    foreground: "#000",
    primary: "#0070f3",
    primaryForeground: "#fff",
    secondary: "#f0f0f0",
    accent: "#7c3aed",
    accentForeground: "#fff",
    card: "#f9f9f9",
    border: "#e0e0e0",
    mutedForeground: "#888",
    destructive: "#ef4444",
  }),
}));

jest.mock("@/contexts/HistoryContext", () => ({
  useHistory: () => ({ addEntry: jest.fn() }),
}));

jest.mock("@/constants/languages", () => ({
  LANGUAGES: ["English", "Spanish", "French", "German"],
}));

jest.mock("@/constants/countryLanguages", () => ({
  COUNTRY_TO_LANGUAGE: {},
}));

jest.mock("@/components/LanguageSelector", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => <View testID="language-selector" />,
  };
});

jest.mock("@/components/SpeakerButton", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => <View testID="speaker-button" />,
  };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: View,
  };
});

jest.mock("@expo/vector-icons", () => ({
  Feather: () => {
    const { View } = require("react-native");
    return <View />;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonNode = {
  children?: Array<JsonNode | string | null> | null;
} | string | null;

/** Recursively find any text node containing the given string. */
function hasText(node: JsonNode, text: string): boolean {
  if (node == null) return false;
  if (typeof node === "string") return node.includes(text);
  if (node.children) {
    return node.children.some((child) => hasText(child as JsonNode, text));
  }
  return false;
}

/** Render the component and let all effects settle. */
async function renderScreen(): Promise<renderer.ReactTestRenderer> {
  let instance!: renderer.ReactTestRenderer;
  await act(async () => {
    instance = renderer.create(<TranslateScreen />);
  });
  return instance;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMockState();
  mockRouterParams = {};
});

describe("Two-phase voice translation UI", () => {
  it("shows the transcribed text and a '...' placeholder while translation is pending", async () => {
    // Populate sourceText via the restore-params path (avoids mocking audio).
    // translatedText is empty and isPending is true → result card should show
    // sourceText + "..." placeholder.
    mockRouterParams = { restoreText: "Bonjour le monde", restoreTranslatedText: "" };
    mockTranslateIsPending = true;

    const instance = await renderScreen();
    const json = instance.toJSON();

    // The transcribed text should be visible
    expect(hasText(json as JsonNode, "Bonjour le monde")).toBe(true);

    // The "..." placeholder should be visible (translation still in flight)
    expect(hasText(json as JsonNode, "...")).toBe(true);
  });

  it("replaces '...' with the translated text once the mutation resolves", async () => {
    // Phase 1: translation in flight
    mockRouterParams = { restoreText: "Hello world", restoreTranslatedText: "" };
    mockTranslateIsPending = true;

    const instance = await renderScreen();
    expect(hasText(instance.toJSON() as JsonNode, "...")).toBe(true);

    // Phase 2: translation has resolved — switch params to include the
    // translated text and flip isPending off, then force a re-render.
    mockTranslateIsPending = false;
    mockRouterParams = {
      restoreText: "Hello world",
      restoreTranslatedText: "Hola mundo",
    };

    await act(async () => {
      instance.update(<TranslateScreen />);
    });

    // Translated text should now be visible, "..." gone
    expect(hasText(instance.toJSON() as JsonNode, "Hola mundo")).toBe(true);
    expect(hasText(instance.toJSON() as JsonNode, "...")).toBe(false);
  });

  it("shows 'Translating...' hint text in voice mode while translation is in flight", async () => {
    // In voice mode (default), the mic-area hint reflects the mutation state.
    mockTranslateIsPending = true;

    const instance = await renderScreen();

    expect(hasText(instance.toJSON() as JsonNode, "Translating...")).toBe(true);
  });
});
