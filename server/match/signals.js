// signals.js — Community Signals adapter (Reddit / Google Reviews / social
// sentiment), behind one internal interface like the booking partners.
//
// These are the one place Scout reaches outside its own data, so each source is
// guarded: live only when its key is present + network egress allows it; in
// LIVE_ONLY mode a missing key fails loudly rather than returning a fake score.
// In dev it returns a clearly-labelled neutral sentiment so the rest of the
// Match subsystem runs offline.
//
// Returns: { score: 0..1, sources: [{name, score, n}], simulated: bool }

import { requireLive } from "../config.js";

async function reddit(query) {
  if (process.env.REDDIT_API_KEY) {
    // TODO: real Reddit search + sentiment -> {score, n}
  }
  return null; // not configured
}
async function googleReviews(query) {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    // TODO: real Places reviews -> {score, n}
  }
  return null;
}
async function social(query) {
  if (process.env.SOCIAL_SENTIMENT_API_KEY) {
    // TODO: real social sentiment -> {score, n}
  }
  return null;
}

export async function communitySentiment(query) {
  const sources = (await Promise.all([reddit(query), googleReviews(query), social(query)])).filter(Boolean);
  if (sources.length) {
    const score = sources.reduce((s, x) => s + x.score, 0) / sources.length;
    return { score, sources, simulated: false };
  }
  // Nothing configured.
  requireLive("Community Signals (REDDIT_API_KEY / GOOGLE_PLACES_API_KEY / SOCIAL_SENTIMENT_API_KEY)");
  return { score: 0.6, sources: [], simulated: true }; // neutral dev default
}
