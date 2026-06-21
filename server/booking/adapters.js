// adapters.js — booking integration adapters behind ONE internal interface.
//
// The product integrates established travel infrastructure (Duffel for flights,
// Kayak for breadth, PHPtravels for activities) rather than rebuilding inventory.
// Each adapter normalizes its partner's results into the same `Option` shape so
// the decision engine reasons over one field of options and never cares which
// partner is behind a given item.
//
// Adapters return deterministic mock inventory until you wire real API keys —
// fill in the marked TODO in each to go live; the engine doesn't change.
//
// Normalized Option:
//   { id, kind: "flight"|"stay"|"activity", title, partner, price,
//     location, duration_hrs, age_min, accessible, tags[] }

import { requireLive } from "../config.js";

// Stable pseudo-random in [0,1) from a string seed, so prices/options don't
// jump between requests for the same destination.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
const money = (base, seed) => Math.round(base * (0.7 + seeded(seed) * 0.8));

// --- Duffel: flights ---
export function duffel(intent) {
  if (process.env.DUFFEL_API_KEY) {
    // TODO: real Duffel call -> map to Option[]; return it here.
  }
  requireLive("Duffel flights (DUFFEL_API_KEY)"); // throws in LIVE_ONLY mode
  const dest = intent.destination || "Destination";
  return ["Nonstop", "1-stop value", "Early-bird"].map((label, i) => ({
    id: `fl_${i}_${dest}`,
    kind: "flight",
    title: `${label} flight to ${dest}`,
    partner: "Duffel",
    price: money(420 + i * 60, `${dest}-fl-${i}`),
    location: dest,
    duration_hrs: 2 + i,
    age_min: 0,
    accessible: true,
    tags: i === 0 ? ["nonstop"] : ["connection"],
  }));
}

// --- Kayak: breadth (stays) ---
export function kayak(intent) {
  if (process.env.KAYAK_API_KEY) {
    // TODO: real Kayak search -> Option[].
  }
  requireLive("Kayak stays (KAYAK_API_KEY)"); // throws in LIVE_ONLY mode
  const dest = intent.destination || "Destination";
  return [
    { label: "Family suite hotel", tags: ["pool", "stroller-friendly", "breakfast"], base: 210 },
    { label: "Budget inn", tags: ["budget", "parking"], base: 120 },
    { label: "Resort w/ kids club", tags: ["pool", "kids-club", "shaded"], base: 320 },
  ].map((s, i) => ({
    id: `st_${i}_${dest}`,
    kind: "stay",
    title: `${s.label} in ${dest}`,
    partner: "Kayak",
    price: money(s.base, `${dest}-st-${i}`),
    location: dest,
    duration_hrs: 0,
    age_min: 0,
    accessible: i !== 1,
    tags: s.tags,
  }));
}

// --- PHPtravels: activities ---
export function phptravels(intent) {
  if (process.env.PHPTRAVELS_API_KEY) {
    // TODO: real PHPtravels call -> Option[].
  }
  requireLive("PHPtravels activities (PHPTRAVELS_API_KEY)"); // throws in LIVE_ONLY mode
  const dest = intent.destination || "Destination";
  const acts = [
    { label: "Children's museum", tags: ["indoor", "educational", "stroller-friendly", "sensory-friendly"], age: 2, base: 18, hrs: 2 },
    { label: "Splash pad & playground", tags: ["outdoor", "playground", "splash", "shaded"], age: 1, base: 0, hrs: 2 },
    { label: "Zoo / wildlife park", tags: ["outdoor", "animals", "stroller-friendly"], age: 2, base: 25, hrs: 4 },
    { label: "Aquarium", tags: ["indoor", "educational", "sensory-friendly"], age: 1, base: 30, hrs: 2 },
    { label: "Family bike + park picnic", tags: ["outdoor", "active", "budget"], age: 5, base: 12, hrs: 3 },
    { label: "Theme park day", tags: ["outdoor", "thrill", "long-day"], age: 3, base: 95, hrs: 6 },
    { label: "Beach morning", tags: ["outdoor", "beach", "shaded", "budget"], age: 0, base: 0, hrs: 3 },
    { label: "Dessert + downtown stroll", tags: ["food", "relaxing", "evening"], age: 0, base: 15, hrs: 1 },
  ];
  return acts.map((a, i) => ({
    id: `ac_${i}_${dest}`,
    kind: "activity",
    title: `${a.label} (${dest})`,
    partner: "PHPtravels",
    price: money(a.base || 1, `${dest}-ac-${i}`) * (a.base ? 1 : 0),
    location: dest,
    duration_hrs: a.hrs,
    age_min: a.age,
    accessible: !a.tags.includes("thrill"),
    tags: a.tags,
  }));
}
