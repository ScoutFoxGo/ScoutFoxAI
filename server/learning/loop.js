// loop.js — the unified Scout learning loop.
//
// HOW SCOUT SELF-LEARNS (statistical half):
// Every recommendation outcome (accepted / rejected / rated) is recorded as an
// event. From those events we maintain:
//   - per-user behavior (likes/dislikes)  -> personalization (match/behavior.js)
//   - aggregate tag acceptance ("what works") -> a learned prior the Match Score
//     folds in, so the WHOLE brain improves as outcomes accumulate.
// This needs no prompts and no external services — it compounds with use.

import { load, save } from "../lms/jsondb.js";
import { recordSignal } from "../match/behavior.js";

const EVENTS = "learning_events";
const STATS = "learning_tagstats";
const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

// Record one outcome. tags = the option's tags; accepted = did the family take it.
export function recordOutcome({ userId = "anon", tags = [], accepted, rating, segment, context } = {}) {
  const ev = {
    userId,
    tags: tags.map(norm),
    accepted: !!accepted,
    rating: rating ?? null,
    segment: segment || null,
    context: context || null,
    ts: Date.now(),
  };
  const log = load(EVENTS, []);
  log.push(ev);
  if (log.length > 5000) log.splice(0, log.length - 5000);
  save(EVENTS, log);

  // aggregate "what works" by tag
  const stats = load(STATS, {});
  for (const t of ev.tags) {
    const s = stats[t] || { shown: 0, accepted: 0 };
    s.shown += 1;
    if (ev.accepted) s.accepted += 1;
    stats[t] = s;
  }
  save(STATS, stats);

  // feed the per-user behavior loop too (skip anonymous)
  if (userId && userId !== "anon") {
    recordSignal(userId, { type: accepted ? "accept" : "reject", tags: ev.tags, rating });
  }
  return ev;
}

// Learned prior for a tag: Laplace-smoothed acceptance rate in [0,1]. 0.5 with no
// evidence, then moves toward what families actually accept. The Match Score
// folds this in (see match/score.js).
export function tagPrior(tag) {
  const s = load(STATS, {})[norm(tag)];
  if (!s || !s.shown) return 0.5;
  return (s.accepted + 1) / (s.shown + 2);
}

// What the brain has learned so far.
export function knowledge() {
  const stats = load(STATS, {});
  const events = load(EVENTS, []);
  const rows = Object.entries(stats).map(([tag, s]) => ({
    tag,
    shown: s.shown,
    accepted: s.accepted,
    acceptance: Number(((s.accepted + 1) / (s.shown + 2)).toFixed(2)),
  }));
  rows.sort((a, b) => b.acceptance - a.acceptance);
  return {
    interactions: events.length,
    learned_tags: rows.length,
    works_best: rows.slice(0, 5),
    avoid: rows.filter((r) => r.acceptance < 0.45).slice(0, 5),
  };
}
