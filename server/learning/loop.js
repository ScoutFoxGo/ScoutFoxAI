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
const PRIOR_STRENGTH = 4;  // pseudo-samples the global mean lends a specialized estimate

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
  return priorBreakdown(tag, segment, context).value;
}

// Like tagPrior, but returns WHY: the global prior, the specialized prior, the
// confidence in the specialization, and the drivers that moved the number off
// neutral/global (segment, context, recent trend). Powers "why this changed".
export function priorBreakdown(tag, segment, context) {
  const t = norm(tag);
  const seg = segment ? norm(segment) : null;
  const qtoks = queryTokens(context);
  const now = Date.now();
  let gwa = 0, gws = 0, ua = 0, un = 0, swa = 0, sws = 0;
  for (const ev of load(EVENTS, [])) {
    if (!ev.tags.includes(t)) continue;
    const w = recencyWeight(ev, now);
    const v = eventValue(ev);
    gwa += w * v; gws += w; ua += v; un += 1;
    if (seg && ev.segment !== seg) continue;
    if (qtoks.length && !qtoks.some((q) => (ev.ctx || []).includes(q))) continue;
    swa += w * v; sws += w;
  }
  // Global posterior: Beta(1,1) uniform prior + weighted evidence (wa successes,
  // ws-wa failures). Mean is the Laplace-smoothed rate.
  const gAlpha = gwa + 1, gBeta = (gws - gwa) + 1;
  const global = gAlpha / (gAlpha + gBeta);
  const globalFlat = un ? (ua + 1) / (un + 2) : 0.5; // unweighted, to isolate recency

  // Specialized posterior (segment/context): use the GLOBAL mean as the prior,
  // with strength PRIOR_STRENGTH pseudo-samples, then add the specific evidence.
  // This is a principled hierarchical Beta — thin specific evidence stays near the
  // global signal, and it earns its independence as samples accumulate. It
  // replaces the old ad-hoc confidence blend AND gives a real posterior we can
  // quantify uncertainty on / Thompson-sample from.
  let alpha = gAlpha, beta = gBeta, evidence = gws;
  if ((seg || qtoks.length) && sws > 0) {
    alpha = global * PRIOR_STRENGTH + swa;
    beta = (1 - global) * PRIOR_STRENGTH + (sws - swa);
    evidence = sws;
  }
  const stats = betaStats(alpha, beta);
  const specific = smooth(swa, sws); // for driver display only

  const drivers = [];
  if (specific != null && (seg || qtoks.length)) {
    const d = specific - global;
    if (Math.abs(d) >= 0.05) {
      const factor = [seg ? `${seg} families` : null, ...qtoks.map((q) => `${q} conditions`)].filter(Boolean).join(" + ");
      drivers.push({ factor, effect: Number(d.toFixed(2)) });
    }
  }
  const rd = global - globalFlat;
  if (Math.abs(rd) >= 0.05) drivers.push({ factor: "recent trend", effect: Number(rd.toFixed(2)) });
  drivers.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));

  const width = stats.interval[1] - stats.interval[0];
  return {
    tag: t,
    value: Number(stats.mean.toFixed(2)),
    global: Number(global.toFixed(2)),
    specific: specific == null ? null : Number(specific.toFixed(2)),
    alpha, beta,
    samples: Number(evidence.toFixed(1)),
    interval: stats.interval, // 90% credible interval
    confidence: Number((1 - width).toFixed(2)), // tighter posterior = more confident
    still_learning: width > 0.3 || evidence < 3,
    drivers,
  };
}

// Mean + 90% credible interval of a Beta(alpha,beta) posterior (normal approx —
// cheap and good enough for ranking display).
function betaStats(alpha, beta) {
  const mean = alpha / (alpha + beta);
  const sd = Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)));
  const z = 1.645; // ~90%
  return { mean, sd, interval: [Number(Math.max(0, mean - z * sd).toFixed(2)), Number(Math.min(1, mean + z * sd).toFixed(2))] };
}

// --- active learning: Thompson sampling ---
// Draw a value from a tag's posterior instead of taking its mean. Used in
// EXPLORE mode so uncertain-but-promising options get a chance to be shown and
// thereby learned about — escaping the feedback-loop trap where Scout only ever
// learns about what it already recommends.
export function samplePrior(tag, segment, context) {
  const b = priorBreakdown(tag, segment, context);
  return betaSample(b.alpha, b.beta);
}
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gammaSample(k) {
  // Marsaglia–Tsang; recurse for shape < 1.
  if (k < 1) return gammaSample(1 + k) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, vv;
    do { x = gaussian(); vv = 1 + c * x; } while (vv <= 0);
    vv = vv * vv * vv;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * vv;
    if (Math.log(u) < 0.5 * x * x + d * (1 - vv + Math.log(vv))) return d * vv;
  }
}
function betaSample(a, b) {
  const x = gammaSample(Math.max(1e-6, a));
  const y = gammaSample(Math.max(1e-6, b));
  return x / (x + y);
}

// COLD-START TRANSFER: the tags a segment tends to accept / reject, so a brand-new
// family with no personal history can inherit their segment's taste from
// interaction #1 instead of starting neutral. Returns recency/rating-weighted
// likes (>=0.6) and dislikes (<=0.4) for the segment.
export function segmentSeed(segment, { min = 0.6, max = 0.4 } = {}) {
  if (!segment) return { likes: [], dislikes: [] };
  const seg = norm(segment);
  const now = Date.now();
  const map = {};
  for (const ev of load(EVENTS, [])) {
    if (ev.segment !== seg) continue;
    const w = recencyWeight(ev, now);
    const v = eventValue(ev);
    for (const t of ev.tags) bump(map, t, w, v);
  }
  const rows = Object.entries(map).map(([tag, s]) => ({ tag, r: smooth(s.wa, s.ws), n: s.ws }));
  return {
    likes: rows.filter((x) => x.r >= min && x.n >= 1).sort((a, b) => b.r - a.r).map((x) => x.tag),
    dislikes: rows.filter((x) => x.r <= max && x.n >= 1).sort((a, b) => a.r - b.r).map((x) => x.tag),
  };
}

// --- forget / reset controls (admin) ---
// Drop events matching ANY combination of criteria (e.g. a bad streak from one
// user, or everything before a date). Requires at least one criterion so it can't
// silently wipe the whole log. Returns how many were removed.
export function forget({ tag, segment, context, before, userId } = {}) {
  const t = tag ? norm(tag) : null;
  const seg = segment ? norm(segment) : null;
  const qtoks = queryTokens(context);
  const cut = before ? new Date(before).getTime() : null;
  if (!t && !seg && !qtoks.length && !cut && !userId) throw new Error("forget needs at least one of: tag, segment, context, before, userId");
  const events = load(EVENTS, []);
  const keep = events.filter((ev) => {
    // an event is forgotten only if it matches every provided criterion
    if (t && !ev.tags.includes(t)) return true;
    if (seg && ev.segment !== seg) return true;
    if (qtoks.length && !qtoks.some((q) => (ev.ctx || []).includes(q))) return true;
    if (userId && ev.userId !== userId) return true;
    if (cut && !(ev.ts < cut)) return true;
    return false;
  });
  const removed = events.length - keep.length;
  save(EVENTS, keep);
  return { removed, remaining: keep.length };
}

// Wipe all learned interactions (durable distilled insights in the corpus stay).
export function reset() {
  const n = load(EVENTS, []).length;
  save(EVENTS, []);
  return { removed: n, remaining: 0 };
}

// Guard rail: flag tags whose RECENT window swings hard from their long-run rate,
// which usually means a feedback streak (genuine or bad) worth a human look.
export function anomalies({ window = 25, threshold = 0.35 } = {}) {
  const events = load(EVENTS, []);
  const recent = events.slice(-window);
  const tagsIn = (arr) => {
    const m = {};
    for (const ev of arr) for (const t of ev.tags) bump(m, t, 1, eventValue(ev));
    return m;
  };
  const all = tagsIn(events);
  const win = tagsIn(recent);
  const out = [];
  for (const [tag, s] of Object.entries(win)) {
    if (s.ws < 3) continue; // need a few recent samples
    const recentRate = smooth(s.wa, s.ws);
    const overall = smooth(all[tag].wa, all[tag].ws);
    const delta = recentRate - overall;
    if (Math.abs(delta) >= threshold) out.push({ tag, recent: Number(recentRate.toFixed(2)), overall: Number(overall.toFixed(2)), swing: Number(delta.toFixed(2)) });
  }
  out.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
  return { window, threshold, flagged: out };
}

// --- reporting: aggregate the whole log once for the knowledge panel ---
function bump(map, tag, w, v) {
  const s = map[tag] || { wa: 0, ws: 0 };
  s.wa += w * v; s.ws += w;
  map[tag] = s;
}
function topTags(map, n = 5, filter) {
  return Object.entries(map)
    .map(([tag, s]) => {
      const { interval } = betaStats(s.wa + 1, s.ws - s.wa + 1);
      return {
        tag,
        acceptance: Number(smooth(s.wa, s.ws).toFixed(2)),
        samples: Number(s.ws.toFixed(1)),
        interval,
        still_learning: interval[1] - interval[0] > 0.3 || s.ws < 3,
      };
    })
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
