// store.js — tiny JSON-file persistence for saved comparisons.
//
// Replaces Base44's `base44.entities.Comparison`. A single append-only JSON
// file is enough for a comparison/share feature; swap for SQLite or Postgres
// if you outgrow it. Each saved comparison gets a short id used for /share/:id.

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), "comparisons.json");

function load() {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function persist(db) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

export function saveComparison(record) {
  const db = load();
  const id = randomUUID().slice(0, 8);
  const saved = { id, created_at: new Date().toISOString(), ...record };
  db[id] = saved;
  persist(db);
  return saved;
}

export function getComparison(id) {
  return load()[id] || null;
}

export function recentComparisons(limit = 20) {
  return Object.values(load())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}
