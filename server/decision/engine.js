// engine.js — the Decision Layer: the core recommendation engine.
//
// Flow: Understand -> Gather -> Reason -> Compose -> Refine.
// Takes a natural-language request + a family profile and returns ONE bookable,
// day-structured, explainable plan (not a list). Every recommendation carries a
// reason. Conversational feedback reshapes the plan.
//
// AI is used only to parse fuzzy natural language (Understand); the reasoning and
// composition are deterministic so plans are explainable and the engine runs
// fully offline. Booking options come through the one integration interface.

import { think, availableBrains } from "../llm.js";
import { gatherOptions } from "../booking/index.js";
import { getFamilyProfile } from "../scoutfoxgo/data.js";
import { SCOUT_SYSTEM_PROMPT, RANKING_WEIGHTS, confidenceLabel } from "../scout/persona.js";

// Stable pseudo-random in [0,1) from a string (quality/novelty proxies until
// real ratings are wired in).
function rnd(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const BUDGET = {
  Low: { activity: 20, stay: 150, flight: 420 },
  Medium: { activity: 60, stay: 280, flight: 650 },
  Higher: { activity: 999, stay: 999, flight: 999 },
};
const PACE_ACTIVITIES = { relaxed: 2, balanced: 3, adventurous: 4 };

// --- 1. UNDERSTAND: natural language -> structured intent ---
export async function understand(input = {}) {
  const fam = input.familyProfileId ? getFamilyProfile(input.familyProfileId) : null;

  // Deterministic baseline parse (works with no AI, no key).
  const req = (input.request || "").toLowerCase();
  const intent = {
    request: input.request || "",
    destination: input.destination || matchAfter(req, ["in ", "near ", "around ", "visit ", "to "]) || "your destination",
    days: input.days || (/\bweekend\b/.test(req) ? 2 : /\bday trip\b/.test(req) ? 1 : 3),
    budget: input.budget || (/(budget|cheap|affordable|low)/.test(req) ? "Low" : /(luxury|splurge|higher|premium)/.test(req) ? "Higher" : "Medium"),
    pace: input.pace || (/(relax|slow|toddler|tired|calm|easy)/.test(req) ? "relaxed" : /(adventur|pack|action|busy|everything|all the)/.test(req) ? "adventurous" : "balanced"),
    prefs: fam ? splitPrefs(fam.preferences) : [],
    family: fam ? { parent: fam.parent_name, kids: fam.kids_info } : null,
    must_haves: [],
    hard_nos: [],
  };

  // Optional AI enrichment — runs on Scout's own brain (Claude OR OpenAI).
  try {
    if (input.request && availableBrains().length) {
      const res = await think({
        maxTokens: 400,
        system: SCOUT_SYSTEM_PROMPT,
        prompt:
          `Extract structured trip intent from: "${input.request}". Return ONLY JSON ` +
          `{"destination":str,"days":int,"budget":"Low"|"Medium"|"Higher",` +
          `"pace":"relaxed"|"balanced"|"adventurous","must_haves":[str],"hard_nos":[str]}.`,
      });
      if (!res.mocked) {
        const m = res.text.match(/\{[\s\S]*\}/);
        if (m) Object.assign(intent, pick(JSON.parse(m[0]), ["destination", "days", "budget", "pace", "must_haves", "hard_nos"]));
      }
    }
  } catch {
    /* keep the deterministic intent */
  }
  return intent;
}

// --- 3. REASON: Scout Ranking Algorithm — weighted score in [0,1] ---
// Subscores follow the spec's weights: preference 30, convenience 20, budget 15,
// accessibility 15, quality 10, weather 5, novelty 5.
function weatherFit(o, weather) {
  if (!weather) return 0.7; // unknown — neutral
  const w = String(weather).toLowerCase();
  const indoor = o.tags.includes("indoor");
  const outdoor = o.tags.includes("outdoor");
  if (/rain|storm|snow|cold|heat|hot|wind/.test(w)) return indoor ? 1 : outdoor ? 0.2 : 0.6;
  return outdoor ? 1 : 0.7;
}

function score(o, intent, weather) {
  const cap = (BUDGET[intent.budget] || BUDGET.Medium)[o.kind] ?? 999;
  const prefs = [...intent.prefs, ...intent.must_haves.map((m) => m.toLowerCase())];
  const hits = prefs.filter((p) => o.tags.some((t) => t.includes(p) || p.includes(t))).length;

  const preference = prefs.length ? Math.min(1, hits / Math.min(3, prefs.length)) : 0.5;
  const convenience = Math.min(1, (o.accessible ? 0.5 : 0) + (o.duration_hrs <= 2 ? 0.5 : o.duration_hrs <= 4 ? 0.3 : 0.1));
  const budget = o.price <= cap ? 1 : Math.max(0, 1 - (o.price - cap) / (cap || 100));
  const accessibility = o.accessible ? 1 : 0.2;
  const quality = 0.5 + rnd(o.id) * 0.5;
  const weather_ = weatherFit(o, weather);
  const novelty = rnd(o.id + "n");

  const W = RANKING_WEIGHTS;
  let total =
    W.preference * preference + W.convenience * convenience + W.budget * budget +
    W.accessibility * accessibility + W.quality * quality + W.weather * weather_ + W.novelty * novelty;

  if (intent.hard_nos.some((n) => o.tags.some((t) => t.includes(n.toLowerCase())))) total = 0;
  if (intent.pace === "relaxed" && o.tags.includes("long-day")) total *= 0.6;
  if (intent.pace === "adventurous" && (o.tags.includes("thrill") || o.tags.includes("active"))) total = Math.min(1, total + 0.1);
  return total;
}

export function reason(intent, options, weather) {
  const rank = (arr) =>
    arr
      .map((o) => {
        const t = score(o, intent, weather);
        return { ...o, _score: Number(t.toFixed(3)), _conf: confidenceLabel(t) };
      })
      .sort((a, b) => b._score - a._score);
  return { flights: rank(options.flights), stays: rank(options.stays), activities: rank(options.activities) };
}

// --- Recommendation Model: Best Match / Alternative / Budget / Premium /
// Indoor + Outdoor backups, each explained (per the Scout system prompt) ---
export function recommend(intent, scored) {
  const acts = scored.activities;
  if (!acts.length) return { error: "no options available" };
  const byPrice = (dir) => [...acts].sort((a, b) => (a.price - b.price) * dir)[0];
  return {
    request: intent.request,
    destination: intent.destination,
    confidence: acts[0]._conf,
    best_match: explainOption(acts[0], intent),
    alternative: acts[1] ? explainOption(acts[1], intent) : null,
    budget_option: explainOption(byPrice(1), intent),
    premium_option: explainOption(byPrice(-1), intent),
    indoor_backup: explainOptionOrNull(acts.find((a) => a.tags.includes("indoor")), intent),
    outdoor_backup: explainOptionOrNull(acts.find((a) => a.tags.includes("outdoor")), intent),
  };
}

export async function recommendTrip(input) {
  const intent = await understand(input);
  const options = gatherOptions(intent);
  const scored = reason(intent, options, input.weather);
  const rec = recommend(intent, scored);
  // Surface the durable, self-learned insights alongside the recommendation so
  // the loop visibly feeds back into answers.
  try {
    const { getLatestInsights } = await import("../learning/distill.js");
    rec.learned = getLatestInsights(2);
  } catch { /* learning optional */ }
  return rec;
}

// --- 4. COMPOSE: assemble the day-structured plan, each item with a reason ---
export function compose(intent, scored) {
  const flight = scored.flights[0];
  const stay = scored.stays[0];
  const perDay = PACE_ACTIVITIES[intent.pace] || 3;
  const relaxed = intent.pace === "relaxed";

  const pool = scored.activities.slice(); // highest-scored first
  const days = [];
  for (let d = 1; d <= intent.days; d++) {
    const items = [];
    if (d === 1 && flight) items.push(item("arrival", flight, `Best ${intent.budget.toLowerCase()}-budget option to ${intent.destination}.`));

    const picks = [];
    while (picks.length < perDay - (relaxed ? 1 : 0) && pool.length) picks.push(pool.shift());

    const slots = ["morning", "midday", "afternoon", "evening"];
    picks.forEach((a, i) => items.push(item(slots[i] || "extra", a, reasonFor(a, intent))));
    if (relaxed) items.push({ slot: "afternoon", title: "Rest / quiet time", kind: "rest", price: 0, reason: "Relaxed pace — a planned break keeps the day from tipping into a meltdown." });

    days.push({ day_number: d, items: items.sort(bySlot) });
  }

  const nights = Math.max(1, intent.days - 1);
  const activityCost = days.flatMap((d) => d.items).filter((i) => i.kind === "activity").reduce((s, i) => s + i.price, 0);
  const estimate = {
    flight: flight?.price || 0,
    stay_per_night: stay?.price || 0,
    nights,
    activities: activityCost,
    total: (flight?.price || 0) + (stay?.price || 0) * nights + activityCost,
  };

  return {
    intent,
    destination: intent.destination,
    summary: `${intent.days}-day ${intent.pace} plan for ${intent.destination}` + (intent.family ? `, tuned for ${intent.family.parent}'s family.` : "."),
    stay: stay ? { title: stay.title, partner: stay.partner, price: stay.price, reason: stayReason(stay, intent) } : null,
    days,
    estimate,
    scout_points_estimate: 50 + (flight ? 100 : 0) + days.length * 20,
    note: "Bookable items connect through partner integrations; you earn Scout Points when you book.",
  };
}

// --- 5. REFINE: conversational edits reshape the plan ---
export function applyFeedback(intent, feedback = "") {
  const f = feedback.toLowerCase();
  const next = { ...intent };
  if (/(cheap|cheaper|budget|less expensive|save)/.test(f)) next.budget = next.budget === "Higher" ? "Medium" : "Low";
  if (/(fancy|nicer|splurge|upgrade|more premium)/.test(f)) next.budget = next.budget === "Low" ? "Medium" : "Higher";
  if (/(slow|slower|less|rest|tired|chill|easy)/.test(f)) next.pace = "relaxed";
  if (/(more|busy|packed|adventurous|faster|do everything)/.test(f)) next.pace = "adventurous";
  if (/(shorter|fewer days)/.test(f) && next.days > 1) next.days -= 1;
  if (/(longer|more days|extra day)/.test(f)) next.days += 1;
  if (/(accessible|stroller|wheelchair|step-free)/.test(f)) next.must_haves = [...new Set([...next.must_haves, "stroller-friendly"])];
  return next;
}

// --- orchestration ---
export async function planTrip(input) {
  const intent = await understand(input);
  const options = gatherOptions(intent);
  const scored = reason(intent, options, input.weather);
  const plan = compose(intent, scored);
  plan.confidence = scored.activities[0]?._conf || "Low";
  return plan;
}

export function refinePlan({ intent, feedback, weather }) {
  const next = applyFeedback(intent, feedback);
  const options = gatherOptions(next);
  const scored = reason(next, options, weather);
  const plan = compose(next, scored);
  plan.confidence = scored.activities[0]?._conf || "Low";
  return { ...plan, refined_from: feedback };
}

// --- recommendation explanation (Trust model: estimates are flagged, nothing
// invented; travel time depends on origin so we say "verify") ---
function explainOptionOrNull(o, intent) {
  return o ? explainOption(o, intent) : null;
}
function explainOption(o, intent) {
  return {
    title: o.title,
    partner: o.partner,
    tags: o.tags || [],
    confidence: o._conf,
    why_fits: reasonFor(o, intent),
    estimated_cost: o.price ? `$${o.price} (estimate — verify)` : "Free",
    travel_time: "varies by your starting point — verify locally",
    ideal_duration: o.duration_hrs ? `${o.duration_hrs}h` : "flexible",
    best_for: bestFor(o),
    drawbacks: drawbacks(o),
    preparation: preparation(o),
  };
}
function bestFor(o) {
  const bits = [];
  if (o.age_min != null) bits.push(o.age_min === 0 ? "all ages" : `ages ${o.age_min}+`);
  if (o.tags.includes("stroller-friendly")) bits.push("families with toddlers");
  if (o.tags.includes("sensory-friendly")) bits.push("sensory-sensitive kids");
  if (o.accessible) bits.push("mobility needs");
  return bits.join(", ") || "most families";
}
function drawbacks(o) {
  const d = [];
  if (o.tags.includes("outdoor")) d.push("weather-dependent");
  if (o.tags.includes("long-day")) d.push("a full day — can be a lot for young kids");
  if (o.tags.includes("thrill")) d.push("not for the youngest travelers");
  if (o.price >= 80) d.push("higher cost");
  return d.join("; ") || "none notable";
}
function preparation(o) {
  const p = [];
  if (o.tags.includes("outdoor") || o.tags.includes("beach")) p.push("sunscreen, water, hats");
  if (o.tags.includes("beach") || o.tags.includes("splash")) p.push("swimwear + change of clothes");
  if (o.price > 0) p.push("buy/reserve tickets ahead");
  return p.join("; ") || "nothing special";
}

// --- helpers ---
function item(slot, o, reason) {
  return { slot, title: o.title, kind: o.kind, price: o.price, partner: o.partner, reason };
}
function reasonFor(a, intent) {
  const hit = intent.prefs.find((p) => a.tags.some((t) => t.includes(p) || p.includes(t)));
  if (hit) return `Matches your "${hit}" preference.`;
  if (a.price === 0) return "Free — easy budget win.";
  if (intent.pace === "relaxed" && a.duration_hrs <= 2) return "Short and low-key for a relaxed pace.";
  return `Strong age-fit, well-reviewed option in ${intent.destination}.`;
}
function stayReason(stay, intent) {
  const hit = intent.prefs.find((p) => stay.tags.some((t) => t.includes(p) || p.includes(t)));
  return hit ? `Picked for your "${hit}" preference.` : `Best value within a ${intent.budget.toLowerCase()} budget.`;
}
const SLOT_ORDER = { arrival: 0, morning: 1, midday: 2, afternoon: 3, evening: 4, extra: 5 };
const bySlot = (a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9);
const STOP_AFTER = new Set("that which for with and but so this these those a an the on in at next over during my our do go see eat find something somewhere".split(" "));
function matchAfter(text, prefixes) {
  for (const p of prefixes) {
    const i = text.indexOf(p);
    if (i < 0) continue;
    const tail = text.slice(i + p.length).split(/[,.!?]/)[0].trim().split(/\s+/);
    const words = [];
    for (const w of tail) {
      if (STOP_AFTER.has(w) || words.length >= 3) break; // place names are short
      words.push(w);
    }
    if (words.length) return words.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}
function splitPrefs(s = "") {
  return s.toLowerCase().split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/\s+/g, "-"));
}
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] != null && !(Array.isArray(obj[k]) && !obj[k].length)) out[k] = obj[k];
  return out;
}
