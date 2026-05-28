/**
 * Termux launcher — run this instead of dist/index.mjs directly.
 * Loads .env using its own absolute path, then starts the server.
 * No external dependencies. Works with PM2, no env-file flags needed.
 *
 *   pm2 start run.mjs --name termuxhost-api
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env");

try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Never overwrite vars already set in the environment
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
  console.log(`[run.mjs] Loaded .env from ${envPath}`);
} catch (e) {
  console.warn(`[run.mjs] Could not load .env: ${e.message}`);
}

await import("./dist/index.mjs");
