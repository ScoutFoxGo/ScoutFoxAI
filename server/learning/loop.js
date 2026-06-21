// loop.js — the unified Scout learning loop.
//
// HOW SCOUT SELF-LEARNS (statistical half):
// Every recommendation outcome (accepted / rejected / rated) is recorded as an
// event. Priors are DERIVED from the event log on demand, which lets one simple
// model capture four things at once:
//   - recency      — recent outcomes count more (exponential decay), so Scout
//                    adapts to changing tastes and seasons instead of being
//                    anchored by old data.
//   - rating       — a 1-5 rating is a finer signal than a binary accept/reject.
//   - segment      — learns differently for toddler-families vs grandparents vs teens.
//   - context      — learns by weather/season (e.g. "indoor wins when it's wet").
// These feed a learned prior the Match Score folds in, so the WHOLE brain
// improves as outcomes accumulate. No prompts, no external services.

import { load, save } from "../lms/jsondb.js";
import { recordSignal } from "../match/behavior.js";

const EVENTS = "learning_events";
const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

const DAY = 86400000;
const HALF_LIFE_DAYS = 45; // an outcome's weight halves every ~6 weeks

// --- signal extraction from one event ---
// Value in [0,1]: prefer the explicit rating (1-5 -> 0..1), else binary accept.
function eventValue(ev) {
  if (ev.rating != null) return Math.max(0, Math.min(1, (Number(ev.rating) - 1) / 4));
  return ev.accepted ? 1 : 0;
}
// Recency weight: 1 for "now", decaying by half-life. Older outcomes matter less.
function recencyWeight(ev, now) {
  const ageDays = Math.max(0, (now - (ev.ts || now)) / DAY);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// --- context buckets (weather + season) ---
function weatherBucket(w) {
  const s = String(w).toLowerCase();
  if (/rain|storm|wet|drizzle/.test(s)) return "wet";
  if (/snow|cold|freez/.test(s)) return "cold";
  if (/hot|heat|scorch/.test(s)) return "hot";
  if (/sun|clear|warm|nice/.test(s)) return "clear";
  return null;
}
function seasonFromTs(ts) {
  const m = new Date(ts || Date.now()).getMonth(); // northern hemisphere
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}
// Normalize a context (string weather, or { weather, season }) into tokens.
function queryTokens(context) {
  if (!context) return [];
  if (typeof context === "string") {
    const b = weatherBucket(context);
    return b ? [b] : [norm(context)];
  }
  const toks = [];
  if (context.weather) { const b = weatherBucket(context.weather); if (b) toks.push(b); }
  if (context.season) toks.push(norm(context.season));
  return toks;
}
// The tokens an event is stamped with (weather bucket + the season it happened in).
function contextTokens(context, ts) {
  const toks = new Set(queryTokens(context));
  toks.add(seasonFromTs(ts));
  return [...toks];
}

// Record one outcome. tags = the option's tags; accepted = did the family take it.
export function recordOutcome({ userId = "anon", tags = [], accepted, rating, segment, context } = {}) {
  const ts = Date.now();
  const ev = {
    userId,
    tags: tags.map(norm),
    accepted: !!accepted,
    rating: rating ?? null,
    segment: segment ? norm(segment) : null,
    context: context || null,
    ctx: contextTokens(context, ts),
    ts,
  };
  const log = load(EVENTS, []);
  log.push(ev);
  if (log.length > 5000) log.splice(0, log.length - 5000);
  save(EVENTS, log);

  // feed the per-user behavior loop too (skip anonymous)
  if (userId && userId !== "anon") {
    recordSignal(userId, { type: accepted ? "accept" : "reject", tags: ev.tags, rating });
  }

  // Auto-distill the durable half on a cadence: every 10 interactions, turn the
  // aggregates into a stored insight in the background (dynamic import avoids a
  // require cycle). This is what makes the knowledge loop self-running.
  if (log.length % 10 === 0) {
    import("./distill.js").then((m) => m.learnInsights()).catch(() => {});
  }
  return ev;
}

// Laplace-smoothed weighted rate in [0,1] from accumulated (weightedAccepted,
// weightedShown). null when there's no evidence.
function smooth(wa, ws) {
  if (!ws) return null;
  return (wa + 1) / (ws + 2);
}

// Learned prior for a tag, optionally specialized to a segment and/or context.
// One pass over the log accumulates recency- and rating-weighted evidence for
// (a) the tag globally and (b) the tag under the requested segment+context.
// The specific signal is blended over the global one, weighted by how much
// specific evidence exists — so a thin slice still leans on the global signal,
// and a well-sampled one trusts itself. The Match Score folds this in.
export function tagPrior(tag, segment, context) {
  const t = norm(tag);
  const seg = segment ? norm(segment) : null;
  const qtoks = queryTokens(context);
  const now = Date.now();
  let gwa = 0, gws = 0, swa = 0, sws = 0;
  for (const ev of load(EVENTS, [])) {
    if (!ev.tags.includes(t)) continue;
    const w = recencyWeight(ev, now);
    const v = eventValue(ev);
    gwa += w * v; gws += w;
    if (seg && ev.segment !== seg) continue;
    if (qtoks.length && !qtoks.some((q) => (ev.ctx || []).includes(q))) continue;
    swa += w * v; sws += w;
  }
  const global = smooth(gwa, gws) ?? 0.5;
  if (!seg && !qtoks.length) return global;
  const specific = smooth(swa, sws);
  if (specific == null) return global;
  const conf = Math.min(1, sws / 10); // full trust at ~10 weighted samples
  return specific * conf + global * (1 - conf);
}

// --- reporting: aggregate the whole log once for the knowledge panel ---
function bump(map, tag, w, v) {
  const s = map[tag] || { wa: 0, ws: 0 };
  s.wa += w * v; s.ws += w;
  map[tag] = s;
}
function topTags(map, n = 5, filter) {
  return Object.entries(map)
    .map(([tag, s]) => ({ tag, acceptance: Number(smooth(s.wa, s.ws).toFixed(2)) }))
    .filter((r) => (filter ? filter(r) : true))
    .sort((a, b) => b.acceptance - a.acceptance)
    .slice(0, n);
}

// What the brain has learned so far (recency/rating-weighted), broken down by
// segment and by context so you can see Scout learning differently per audience
// and per condition.
export function knowledge() {
  const events = load(EVENTS, []);
  const now = Date.now();
  const global = {};
  const seg = {};
  const ctx = {};
  for (const ev of events) {
    const w = recencyWeight(ev, now);
    const v = eventValue(ev);
    for (const t of ev.tags) {
      bump(global, t, w, v);
      if (ev.segment) bump((seg[ev.segment] ||= {}), t, w, v);
      for (const c of ev.ctx || []) bump((ctx[c] ||= {}), t, w, v);
    }
  }
  const by_segment = Object.fromEntries(Object.entries(seg).map(([k, m]) => [k, topTags(m, 3)]));
  const by_context = Object.fromEntries(Object.entries(ctx).map(([k, m]) => [k, topTags(m, 3)]));
  return {
    interactions: events.length,
    learned_tags: Object.keys(global).length,
    half_life_days: HALF_LIFE_DAYS,
    works_best: topTags(global, 5),
    avoid: topTags(global, 5, (r) => r.acceptance < 0.45),
    by_segment,
    by_context,
  };
}
