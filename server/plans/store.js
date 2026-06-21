// store.js — saved, shareable trip plans.
//
// Persistence + a short id so a composed plan can live at /plan.html?id=… and be
// shared. In-house JSON store (gitignored runtime file); swap for a real DB if you
// outgrow it. Mirrors the comparison-share pattern in server/store.js.

import { load, save } from "../lms/jsondb.js";

const FILE = "shared_plans";
const newId = () => Math.random().toString(36).slice(2, 10);

export function savePlan(plan, meta = {}) {
  if (!plan) throw new Error("plan required");
  const db = load(FILE, {});
  const id = newId();
  const rec = { id, created_at: new Date().toISOString(), plan, meta };
  db[id] = rec;
  save(FILE, db);
  return rec;
}

export function getPlan(id) {
  return load(FILE, {})[id] || null;
}

export function recentPlans(limit = 20) {
  return Object.values(load(FILE, {}))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}
