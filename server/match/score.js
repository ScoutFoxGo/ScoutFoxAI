// score.js — Scout Match Score + Decision Confidence Score.
//
// Turns "100 options" into a single confident read: a 0-100 match % with a band
// (Best / Good / Risky / Weak). Blends learned behavior (likes/dislikes/budget),
// family preferences, community sentiment, and quality — the Lickly-style
// confidence display, grounded in the user's own profile.

import { getFamilyProfile } from "../scoutfoxgo/data.js";
import { getProfile } from "./behavior.js";
import { communitySentiment } from "./signals.js";
import { priorBreakdown } from "../learning/loop.js";

const W = { preference: 0.45, budget: 0.25, sentiment: 0.2, quality: 0.1 };

function rnd(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

export function band(pct) {
  if (pct >= 85) return "Best Match";
  if (pct >= 70) return "Good Match";
  if (pct >= 50) return "Risky Match";
  return "Weak Match";
}
function confidence(pct, signals) {
  if (pct >= 85 && signals >= 3) return "High";
  if (pct >= 70 || signals >= 3) return "Medium";
  return "Low";
}

// target: { title, tags[], kind?, price? }
// subject: { userId?, familyProfileId? }
export async function matchScore(target, subject = {}) {
  const tags = (target.tags || []).map(norm);
  const fam = subject.familyProfileId ? getFamilyProfile(subject.familyProfileId) : null;
  const seg = subject.segment || (fam && fam.segment) || null;
  // COLD-START: a new user with a known segment inherits that segment's taste.
  const profile = subject.userId ? getProfile(subject.userId, seg) : { likes: [], dislikes: [], budget_cap: null, signals: 0 };
  const famPrefs = fam ? fam.preferences.toLowerCase().split(/[,;]/).map((x) => norm(x)).filter(Boolean) : [];
  const likes = [...new Set([...profile.likes, ...famPrefs])];

  const reasons = [];
  if (profile.seeded_from) reasons.push(`new here — starting from what ${profile.seeded_from} families tend to like`);
  // Preference fit
  const liked = likes.filter((p) => tags.some((t) => t.includes(p) || p.includes(t)));
  const preference = likes.length ? Math.min(1, liked.length / Math.min(4, likes.length)) : 0.5;
  if (liked.length) reasons.push(`matches what you like: ${liked.join(", ")}`);

  // Dislikes penalty
  const disliked = profile.dislikes.filter((d) => tags.some((t) => t.includes(d) || d.includes(t)));
  if (disliked.length) reasons.push(`heads up — includes things you've disliked: ${disliked.join(", ")}`);

  // Budget fit
  let budget = 0.7;
  if (profile.budget_cap != null && target.price != null) {
    budget = target.price <= profile.budget_cap ? 1 : Math.max(0, 1 - (target.price - profile.budget_cap) / (profile.budget_cap || 100));
    reasons.push(target.price <= profile.budget_cap ? `within your ~$${profile.budget_cap} budget` : `over your ~$${profile.budget_cap} budget`);
  }

  // Community sentiment
  const sent = await communitySentiment(target.title || tags.join(" "));
  if (!sent.simulated) reasons.push(`community sentiment ${(sent.score * 100).toFixed(0)}%`);

  const quality = 0.5 + rnd(target.title || tags.join("")) * 0.5;

  let raw = W.preference * preference + W.budget * budget + W.sentiment * sent.score + W.quality * quality;
  raw -= Math.min(0.4, disliked.length * 0.2); // dislikes pull the score down

  // SELF-LEARNING: fold in the learned prior ("what families actually accept")
  // for these tags, blended at 15%. The prior is recency- and rating-weighted and,
  // when known, specialized to the family's segment AND the current context
  // (weather/season) — e.g. "indoor wins when it's wet" — over the global signal.
  // As outcomes accumulate, scores shift toward what works for this kind of family
  // under these conditions. The whole brain improves from the loop.
  const ctx = subject.context || subject.weather || target.weather || null;
  const breaks = tags.map((t) => priorBreakdown(t, seg, ctx));
  const learned = breaks.length ? breaks.reduce((s, b) => s + b.value, 0) / breaks.length : 0.5;
  raw = raw * 0.85 + learned * 0.15;

  // "Why this changed": surface the single strongest learned driver, so the score
  // is auditable rather than a black box.
  const drv = breaks.flatMap((b) => b.drivers.map((d) => ({ tag: b.tag, ...d }))).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))[0];
  if (drv) reasons.push(`learned: "${drv.tag}" ${drv.effect > 0 ? "does better" : "does worse"} with ${drv.factor} (${drv.effect > 0 ? "+" : ""}${Math.round(drv.effect * 100)}%)`);

  const pct = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return {
    target: target.title || "(untitled)",
    match_score: pct,
    band: band(pct),
    confidence: confidence(pct, profile.signals),
    reasons,
    sentiment_simulated: sent.simulated,
  };
}

// Rank a list of targets by match score (highest first).
export async function rankByMatch(targets, subject) {
  const scored = await Promise.all(targets.map(async (t) => ({ ...t, ...(await matchScore(t, subject)) })));
  return scored.sort((a, b) => b.match_score - a.match_score);
}
