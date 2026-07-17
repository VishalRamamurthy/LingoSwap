/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Extend the preset's pnpm-aware transformIgnorePatterns to also transform
  // workspace packages (which ship TypeScript source).
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@workspace))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  setupFiles: [
    // react-native-reanimated requires its own jest mock to work in Node.
    "react-native-reanimated/mock",
  ],
  moduleNameMapper: {
    // @testing-library/react-native v14 imports 'test-renderer' (bare name).
    "^test-renderer$": "react-test-renderer",
    "^test-renderer/(.*)$": "react-test-renderer/$1",
    // Resolve Expo path alias (@/) to the translator root.
    "^@/(.*)$": "<rootDir>/$1",
  },
};
