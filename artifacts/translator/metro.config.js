const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block Metro from watching server-only type packages that create temp
// directories during install, which causes a file-watcher ENOENT crash.
const blockPatterns = [
  // connect-pg-simple types write a temp dir that disappears after install
  /node_modules[/\\]\.pnpm[/\\]@types\+connect-pg-simple[/\\]/,
  /node_modules[/\\]\.pnpm[/\\]@types\+express-session[/\\]/,
  /node_modules[/\\]\.pnpm[/\\]@types\+bcryptjs[/\\]/,
];

const originalBlockList = config.resolver?.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver = {
  ...config.resolver,
  blockList: [...originalBlockList, ...blockPatterns],
};

module.exports = config;
