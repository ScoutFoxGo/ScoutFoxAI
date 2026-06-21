// env.js — zero-dependency .env loader.
//
// Imported FIRST in index.js so keys pasted into server/.env (or a repo-root .env)
// populate process.env BEFORE any module reads them (config.js, llm.js, the booking
// adapters, etc. all read process.env). No npm install, works on any Node version.
//
// Precedence: a value already set in the shell/host ALWAYS wins — the file only
// fills in what isn't already provided. That means platforms that inject real env
// vars (Render, Railway, Docker -e, CI secrets) override the file, and the file is
// just a convenience for local/self-hosted runs.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [join(here, ".env"), join(here, "..", ".env")]; // server/.env, then repo-root .env

function parse(text) {
  let count = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // shell/host wins; don't override
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
    count++;
  }
  return count;
}

let envFile = null;
let loadedCount = 0;
for (const p of candidates) {
  if (!existsSync(p)) continue;
  try {
    loadedCount = parse(readFileSync(p, "utf8"));
    envFile = p;
  } catch {
    /* ignore unreadable file */
  }
  break;
}

export { envFile, loadedCount };
