// jsondb.js — minimal JSON-file persistence shared by the LMS modules.
// Keeps the LMS fully self-contained (no external DB/SaaS). Swap for SQLite or
// Postgres when the corpus outgrows a flat file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));

export function dbPath(name) {
  return join(DIR, `${name}.json`);
}

export function load(name, fallback = {}) {
  const p = dbPath(name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

export function save(name, data) {
  writeFileSync(dbPath(name), JSON.stringify(data, null, 2));
}
