// setup.js — one-command env scaffold. Run with `npm run setup`.
//
// Copies .env.example -> .env if it doesn't exist yet (never overwrites your real
// keys), then prints the next step. Cross-platform (plain Node, works on Windows).

import { existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, ".env.example");
const target = join(here, ".env");

if (!existsSync(example)) {
  console.error("✗ .env.example not found — are you in the server/ directory?");
  process.exit(1);
}

if (existsSync(target)) {
  console.log("✓ server/.env already exists — leaving it untouched (your keys are safe).");
} else {
  copyFileSync(example, target);
  console.log("✓ Created server/.env from .env.example.");
}

console.log("\nNext:");
console.log("  1. Open server/.env and paste your keys after each '=' (blank = mock mode).");
console.log("  2. Start the server:   npm start");
console.log("  3. Confirm what's live: curl http://localhost:8787/api/status");
console.log("\nSee API_KEYS.md for what each key unlocks. .env is gitignored — keys never get committed.");
