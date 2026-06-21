// behavior.js — the Behavior Learning Loop.
//
// A per-user profile that learns from explicit signals (likes/dislikes/budget)
// and implicit ones (accepted/rejected recommendations). It feeds the Scout
// Match Score so recommendations improve over time. userId is the ScoutFoxGo
// identity join key. In-house JSON store; no external service.

import { load, save } from "../lms/jsondb.js";

const FILE = "match_behavior";

export function getProfile(userId) {
  const db = load(FILE, {});
  return db[userId] || { userId, likes: [], dislikes: [], budget_cap: null, ratings: [], signals: 0 };
}

function persist(p) {
  const db = load(FILE, {});
  db[p.userId] = p;
  save(FILE, db);
  return p;
}

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");
const add = (arr, v) => (arr.includes(v) ? arr : [...arr, v]);
const remove = (arr, v) => arr.filter((x) => x !== v);

// Record a signal. Examples:
//   {type:"like", value:"beaches"}            -> likes
//   {type:"dislike", value:"crowds"}          -> dislikes
//   {type:"budget", value:150}                -> budget_cap
//   {type:"accept", tags:["beach","shaded"], title, rating?} -> implicit likes + rating
//   {type:"reject", tags:["thrill","long-day"]}              -> implicit dislikes
export function recordSignal(userId, signal = {}) {
  const p = getProfile(userId);
  const { type } = signal;
  if (type === "like") { p.likes = add(p.likes, norm(signal.value)); p.dislikes = remove(p.dislikes, norm(signal.value)); }
  else if (type === "dislike") { p.dislikes = add(p.dislikes, norm(signal.value)); p.likes = remove(p.likes, norm(signal.value)); }
  else if (type === "budget") { p.budget_cap = Number(signal.value) || p.budget_cap; }
  else if (type === "accept") {
    for (const t of signal.tags || []) p.likes = add(p.likes, norm(t));
    if (signal.rating != null) p.ratings.push({ tags: (signal.tags || []).map(norm), title: signal.title || "", rating: Number(signal.rating), at: Date.now() });
  } else if (type === "reject") {
    for (const t of signal.tags || []) p.dislikes = add(p.dislikes, norm(t));
  } else {
    throw new Error("unknown signal type (like|dislike|budget|accept|reject)");
  }
  p.signals += 1;
  return persist(p);
}

export function allProfiles() {
  return Object.values(load(FILE, {}));
}
