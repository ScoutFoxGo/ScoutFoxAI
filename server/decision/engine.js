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

import { invokeLLM } from "../llm.js";
import { gatherOptions } from "../booking/index.js";
import { getFamilyProfile } from "../scoutfoxgo/data.js";

const MODEL = "claude_opus_4_8";

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
    destination: input.destination || matchAfter(req, ["to ", "in ", "visit "]) || "your destination",
    days: input.days || (/\bweekend\b/.test(req) ? 2 : /\bday trip\b/.test(req) ? 1 : 3),
    budget: input.budget || (/(budget|cheap|affordable|low)/.test(req) ? "Low" : /(luxury|splurge|higher|premium)/.test(req) ? "Higher" : "Medium"),
    pace: input.pace || (/(relax|slow|toddler|tired|calm|easy)/.test(req) ? "relaxed" : /(adventur|pack|action|busy|everything|all the)/.test(req) ? "adventurous" : "balanced"),
    prefs: fam ? splitPrefs(fam.preferences) : [],
    family: fam ? { parent: fam.parent_name, kids: fam.kids_info } : null,
    must_haves: [],
    hard_nos: [],
  };

  // Optional AI enrichment — only when a real model is wired up.
  try {
    if (input.request) {
      const probe = await invokeLLM({ modelKey: MODEL, prompt: "ping", maxTokens: 8 });
      if (!probe.mocked) {
        const res = await invokeLLM({
          modelKey: MODEL,
          maxTokens: 400,
          prompt:
            `Extract structured trip intent from: "${input.request}". Return ONLY JSON ` +
            `{"destination":str,"days":int,"budget":"Low"|"Medium"|"Higher",` +
            `"pace":"relaxed"|"balanced"|"adventurous","must_haves":[str],"hard_nos":[str]}.`,
        });
        const m = res.text.match(/\{[\s\S]*\}/);
        if (m) Object.assign(intent, pick(JSON.parse(m[0]), ["destination", "days", "budget", "pace", "must_haves", "hard_nos"]));
      }
    }
  } catch {
    /* keep the deterministic intent */
  }
  return intent;
}

// --- 3. REASON: score options against the family's actual constraints ---
function score(option, intent) {
  const cap = BUDGET[intent.budget] || BUDGET.Medium;
  let s = 1;
  // Budget fit
  const limit = cap[option.kind] ?? 999;
  if (option.price <= limit) s += 2;
  else s -= Math.min(3, (option.price - limit) / 50);
  // Family preference tags (stroller-friendly, sensory-friendly, shaded, playground...)
  for (const p of intent.prefs) {
    if (option.tags.some((t) => t.includes(p) || p.includes(t))) s += 1.5;
  }
  // Must-haves / hard-nos
  for (const m of intent.must_haves) if (option.tags.some((t) => t.includes(m.toLowerCase()))) s += 2;
  for (const n of intent.hard_nos) if (option.tags.some((t) => t.includes(n.toLowerCase()))) s -= 4;
  // Accessibility bias for family travel
  if (option.accessible) s += 0.5;
  // Pace: relaxed families avoid long-day activities
  if (intent.pace === "relaxed" && option.tags.includes("long-day")) s -= 2;
  if (intent.pace === "adventurous" && (option.tags.includes("thrill") || option.tags.includes("active"))) s += 1;
  return s;
}

export function reason(intent, options) {
  const rank = (arr) => arr.map((o) => ({ ...o, _score: score(o, intent) })).sort((a, b) => b._score - a._score);
  return {
    flights: rank(options.flights),
    stays: rank(options.stays),
    activities: rank(options.activities),
  };
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
  const scored = reason(intent, options);
  return compose(intent, scored);
}

export function refinePlan({ intent, feedback }) {
  const next = applyFeedback(intent, feedback);
  const options = gatherOptions(next);
  const scored = reason(next, options);
  return { ...compose(next, scored), refined_from: feedback };
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
const STOP_AFTER = new Set("that which for with and but so this these those a an the on in at next over during my our".split(" "));
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
