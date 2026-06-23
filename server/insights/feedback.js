// feedback.js — structured user feedback (the "talk to users every week" half).
//
// Captures qualitative signal beyond the 👍/👎 the learning loop already tracks:
// a 1-5 rating, an optional NPS (0-10), a free-text comment, and the area it's
// about. Stored in-house; summarized into stats + themes for the weekly review.

import { load, save } from "../lms/jsondb.js";

const FILE = "insights_feedback";
const newId = () => "fb_" + Math.random().toString(36).slice(2, 9);
const WEEK = 7 * 86400000;

export function recordFeedback({ userId = "anon", rating, nps, comment = "", area = "general", sessionId } = {}) {
  const fb = {
    id: newId(),
    userId,
    rating: rating != null ? Math.max(1, Math.min(5, Number(rating))) : null,
    nps: nps != null ? Math.max(0, Math.min(10, Number(nps))) : null,
    comment: String(comment).slice(0, 1000),
    area,
    sessionId: sessionId || null,
    ts: Date.now(),
  };
  const log = load(FILE, []);
  log.push(fb);
  if (log.length > 5000) log.splice(0, log.length - 5000);
  save(FILE, log);
  return fb;
}

export function listFeedback(limit = 50) {
  return load(FILE, []).slice(-limit).reverse();
}

const STOP = new Set("the a an and or but of to in on for with is are was it its this that you your we our us they them too very really just so much more less not no".split(" "));
function themes(comments, n = 6) {
  const counts = {};
  for (const c of comments) {
    for (const w of String(c).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
      if (w.length > 3 && !STOP.has(w)) counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));
}

// Stats over a window (default: last 7 days). NPS = %promoters(9-10) − %detractors(0-6).
export function feedbackStats({ windowDays = 7 } = {}) {
  const all = load(FILE, []);
  const since = Date.now() - windowDays * 86400000;
  const rows = all.filter((f) => f.ts >= since);
  const ratings = rows.map((r) => r.rating).filter((r) => r != null);
  const npsVals = rows.map((r) => r.nps).filter((r) => r != null);
  const avg = ratings.length ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)) : null;
  const nps = npsVals.length
    ? Math.round((100 * (npsVals.filter((v) => v >= 9).length - npsVals.filter((v) => v <= 6).length)) / npsVals.length)
    : null;
  const comments = rows.filter((r) => r.comment).map((r) => r.comment);
  const byArea = {};
  for (const r of rows) byArea[r.area] = (byArea[r.area] || 0) + 1;
  return {
    window_days: windowDays,
    responses: rows.length,
    avg_rating: avg,
    nps_score: nps,
    by_area: byArea,
    themes: themes(comments),
    recent_comments: rows.filter((r) => r.comment).slice(-5).reverse().map((r) => ({ area: r.area, rating: r.rating, comment: r.comment })),
    low_rated: rows.filter((r) => r.rating != null && r.rating <= 2).slice(-5).map((r) => ({ comment: r.comment, area: r.area, rating: r.rating })),
  };
}
