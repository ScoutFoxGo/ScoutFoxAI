// predict.js — Experience Prediction ("Families like yours rated this 94%").
//
// Two-stage estimate, fully in-house:
//   1. Collaborative: find users with overlapping likes ("families like yours")
//      and average their recorded ratings for similar experiences (tag overlap).
//   2. Fallback: when there isn't enough peer data yet, use the Scout Match Score
//      as the estimate and say so. Improves as the behavior loop accumulates
//      ratings.

import { allProfiles, getProfile } from "./behavior.js";
import { matchScore } from "./score.js";

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");
const overlap = (a, b) => a.filter((x) => b.includes(x)).length;

export async function predict(target, subject = {}) {
  const tags = (target.tags || []).map(norm);
  const me = subject.userId ? getProfile(subject.userId) : { userId: null, likes: [] };

  // Peers: other users who share at least 2 liked tags with me.
  const peers = allProfiles().filter((p) => p.userId !== me.userId && overlap(p.likes, me.likes) >= 2);

  // Their ratings for experiences similar to this target (tag overlap >= 2).
  const ratings = [];
  for (const p of peers) {
    for (const r of p.ratings || []) {
      if (overlap(r.tags || [], tags) >= 2 && Number.isFinite(r.rating)) ratings.push(r.rating);
    }
  }

  if (ratings.length >= 3) {
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const pct = Math.round((avg / 5) * 100); // ratings stored 0..5
    return {
      target: target.title || "(untitled)",
      prediction_pct: pct,
      headline: `Families like yours rated this ${pct}%`,
      basis: "peer ratings",
      n_similar_families: peers.length,
      n_ratings: ratings.length,
    };
  }

  // Not enough peer data — fall back to the match score, honestly labelled.
  const m = await matchScore(target, subject);
  return {
    target: m.target,
    prediction_pct: m.match_score,
    headline: `Predicted ${m.match_score}% fit for your family`,
    basis: "preference fit (not enough similar-family ratings yet)",
    n_similar_families: peers.length,
    n_ratings: ratings.length,
  };
}
