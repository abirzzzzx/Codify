/**
 * Termux-compatible build script — runs on Android/ARM64.
 * Usage: node termux-build.mjs
 *
 * Unlike build.mjs (which requires the pnpm workspace), this script:
 *  - installs esbuild + esbuild-plugin-pino from the termux/ folder
 *  - resolves @workspace/* packages via path aliases
 *  - works on any Node.js 18+ without pnpm
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);

// esbuild + pino plugin live in termux/node_modules after `npm install`
const { build } = await import(
  path.resolve(__dirname, "termux/node_modules/esbuild/lib/main.js")
);
// Entry point is dist/index.js — resolve it from the installed package's own package.json
const pinoPluginPkg = JSON.parse(
  (await import("node:fs")).readFileSync(
    path.resolve(__dirname, "termux/node_modules/esbuild-plugin-pino/package.json"),
    "utf8"
  )
);
const pinoPluginMain = pinoPluginPkg.main || pinoPluginPkg.exports?.["."] || "dist/index.js";
const { default: esbuildPluginPino } = await import(
  path.resolve(__dirname, "termux/node_modules/esbuild-plugin-pino", pinoPluginMain)
);

const distDir = path.resolve(__dirname, "dist");

console.log("Building TermuxHost API for Termux (ARM64)...");
console.log("Entry:  src/index.ts");
console.log("Output: dist/index.mjs\n");

await build({
  entryPoints: [path.resolve(__dirname, "src/index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",

  // Resolve @workspace/* packages to their TypeScript source
  alias: {
    "@workspace/db":      path.resolve(__dirname, "../../lib/db/src/index.ts"),
    "@workspace/api-zod": path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
  },

  external: [
    "*.node",
    "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
    "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil",
    "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider",
    "isolated-vm", "lightningcss", "pg-native", "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "@ngrok/ngrok",
    "pm2",
    "handlebars", "knex", "typeorm", "protobufjs", "onnxruntime-node",
    "@tensorflow/*", "@prisma/client", "@mikro-orm/*",
    "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*",
    "@opentelemetry/*", "@google-cloud/*", "@google/*",
    "googleapis", "firebase-admin", "@parcel/watcher",
    "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
    "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis",
    "kerberos", "leveldown", "miniflare", "mysql2", "newrelic",
    "odbc", "piscina", "realm", "ref-napi", "rocksdb",
    "sass-embedded", "sequelize", "serialport", "snappy",
    "tinypool", "usb", "workerd", "wrangler", "zeromq",
    "zeromq-prebuilt", "playwright", "puppeteer", "puppeteer-core", "electron",
  ],

  sourcemap: "linked",

  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],

  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
}).catch((err) => {
  console.error("\n[!] Build failed:", err.message);
  process.exit(1);
});

console.log("\nBuild complete → dist/index.mjs");
