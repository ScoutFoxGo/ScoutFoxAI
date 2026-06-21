// seed-knowledge.js — ingest the product spec into the closed LMS corpus.
//
// Run: `npm run seed:knowledge` (from server/). Ingests the Missing Modules
// addendum and the launch decisions doc so Scout can answer team questions about
// the product itself, fully in-house. Idempotent-ish: re-running re-ingests; the
// corpus is a flat store, so clear it first if you want a clean reseed.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ingestDocument } from "./ingest.js";

const here = dirname(fileURLToPath(import.meta.url));

const DOCS = [
  {
    path: join(here, "knowledge", "missing-modules-addendum.md"),
    title: "Missing Modules Addendum",
    category: "Product Spec",
    tags: ["addendum", "scope", "modules"],
    version: "1.0",
  },
  {
    path: join(here, "..", "..", "LAUNCH_DECISIONS.md"),
    title: "Launch Decisions",
    category: "Product Spec",
    tags: ["launch", "decisions"],
    version: "1.0",
  },
];

let total = 0;
for (const d of DOCS) {
  if (!existsSync(d.path)) {
    console.warn(`skip (not found): ${d.path}`);
    continue;
  }
  const text = readFileSync(d.path, "utf8");
  const r = ingestDocument({ title: d.title, category: d.category, tags: d.tags, text, version: d.version });
  total += r.created;
  console.log(`ingested "${d.title}" -> ${r.created} lesson chunk(s)`);
}
console.log(`done — ${total} lesson chunk(s) added to the corpus.`);
