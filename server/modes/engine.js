// engine.js — Scout Modes: Mom Route™ / Dad Mode™ / Grandparent Mode™.
//
// A mode is a named lens over the same options that optimizes for a different
// thing — ease vs adventure vs accessibility. It re-ranks activities and lays
// them out as a day route. In-house; runs on the booking options + family prefs.

import { gatherOptions } from "../booking/index.js";
import { getFamilyProfile } from "../scoutfoxgo/data.js";

export const MODES = {
  mom_route: {
    label: "Mom Route™",
    pace: "relaxed",
    optimize: "ease — bathrooms, parking, shade, short walks, snacks, rest",
    prioritize: ["stroller-friendly", "shaded", "playground", "restroom", "sensory-friendly", "budget"],
    avoid: ["thrill", "long-day"],
  },
  dad_mode: {
    label: "Dad Mode™",
    pace: "adventurous",
    optimize: "adventure and fun per hour",
    prioritize: ["active", "thrill", "outdoor", "sports", "animals"],
    avoid: [],
  },
  grandparent_mode: {
    label: "Grandparent Mode™",
    pace: "relaxed",
    optimize: "accessibility, comfort, rest, shorter walks",
    prioritize: ["accessible", "relaxing", "cultural", "shaded", "indoor"],
    avoid: ["thrill", "long-day", "active"],
  },
};

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

function score(o, mode, famPrefs) {
  let s = 0;
  for (const p of mode.prioritize) if (o.tags.some((t) => t.includes(p) || p.includes(t))) s += 2;
  for (const a of mode.avoid) if (o.tags.some((t) => t.includes(a))) s -= 2;
  for (const p of famPrefs) if (o.tags.some((t) => t.includes(p))) s += 1;
  if (o.accessible) s += 0.5;
  if (o.price === 0) s += 0.5;
  return s;
}
function why(o, mode) {
  const hit = mode.prioritize.find((p) => o.tags.some((t) => t.includes(p) || p.includes(t)));
  if (hit) return `${mode.label.replace("™", "")} pick — ${hit.replace(/-/g, " ")}`;
  if (o.price === 0) return "free and easy";
  return "solid fit for this mode";
}

const SLOTS = ["morning", "midday", "afternoon", "evening"];

export function recommendForMode(modeName, { destination = "your area", familyProfileId } = {}) {
  const mode = MODES[modeName];
  if (!mode) throw new Error(`unknown mode (mom_route | dad_mode | grandparent_mode)`);
  const fam = familyProfileId ? getFamilyProfile(familyProfileId) : null;
  const famPrefs = fam ? fam.preferences.toLowerCase().split(/[,;]/).map((x) => norm(x)).filter(Boolean) : [];

  const acts = gatherOptions({ destination }).activities;
  const ranked = acts
    .map((o) => ({ ...o, _score: score(o, mode, famPrefs) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 4);

  const route = ranked.map((o, i) => ({
    slot: SLOTS[i] || "extra",
    title: o.title,
    price: o.price ? `$${o.price}` : "Free",
    why: why(o, mode),
  }));
  if (mode.pace === "relaxed") route.splice(2, 0, { slot: "break", title: "Rest / snack stop", price: "Free", why: "built-in downtime keeps the day from tipping over" });

  return { mode: mode.label, optimized_for: mode.optimize, pace: mode.pace, destination, route };
}
