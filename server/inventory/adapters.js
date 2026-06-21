// adapters.js — unified inventory beyond flights: hotels, cruises, activities.
//
// One normalized Option shape across categories so the Scout brain reasons over
// them the same way. Each adapter is live when its supplier key is set, a
// labelled mock otherwise, and fails loudly under LIVE_ONLY. Real-supplier calls
// are marked TODO (hotels: Duffel Stays; activities: Viator/GetYourGuide;
// cruises: a cruise aggregator) — wire your key in the marked slot; nothing else
// changes.
//
// Option: { id, type, title, supplier, price, currency, location, rating, tags[], bookable }

import { requireLive } from "../config.js";

function money(base, seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Math.round(base * (0.8 + ((h >>> 0) % 100) / 250));
}
const mk = (o) => ({ currency: "USD", bookable: true, tags: [], ...o });

export async function hotels({ destination = "your destination", check_in, check_out, guests = 2 }) {
  if (process.env.DUFFEL_API_KEY) {
    // TODO: Duffel Stays search (POST /stays/search) -> map to Option[].
  }
  requireLive("Hotels (DUFFEL_API_KEY / Stays)");
  return [
    { label: "Family suite hotel", base: 210, rating: 4.4, tags: ["pool", "stroller-friendly", "breakfast", "family"] },
    { label: "Budget inn", base: 120, rating: 3.8, tags: ["budget", "parking"] },
    { label: "Resort w/ kids club", base: 320, rating: 4.6, tags: ["pool", "kids-club", "shaded", "family"] },
  ].map((h, i) => mk({ id: `htl_${i}_${destination}`, type: "hotel", title: `${h.label} — ${destination}`, supplier: "Stays", price: money(h.base, `${destination}h${i}`), location: destination, rating: h.rating, tags: h.tags, simulated: true }));
}

export async function activities({ destination = "your destination" }) {
  if (process.env.VIATOR_API_KEY || process.env.GETYOURGUIDE_API_KEY) {
    // TODO: real activities supplier -> Option[].
  }
  requireLive("Activities (VIATOR_API_KEY / GETYOURGUIDE_API_KEY)");
  return [
    { label: "Children's museum", base: 18, rating: 4.5, tags: ["indoor", "educational", "museum", "stroller-friendly", "sensory-friendly"] },
    { label: "Zoo / wildlife park", base: 25, rating: 4.6, tags: ["outdoor", "zoo", "animals", "family"] },
    { label: "Aquarium", base: 30, rating: 4.5, tags: ["indoor", "aquarium", "educational"] },
    { label: "Theme park day", base: 95, rating: 4.7, tags: ["outdoor", "theme park", "thrill", "long-day"] },
    { label: "Beach + splash pad", base: 0, rating: 4.4, tags: ["outdoor", "beach", "splash", "shaded", "budget"] },
  ].map((a, i) => mk({ id: `act_${i}_${destination}`, type: "activity", title: `${a.label} — ${destination}`, supplier: "Activities", price: a.base ? money(a.base, `${destination}a${i}`) : 0, location: destination, rating: a.rating, tags: a.tags, simulated: true }));
}

export async function cruises({ region = "Caribbean", nights = 4 }) {
  if (process.env.CRUISE_API_KEY) {
    // TODO: real cruise aggregator -> Option[].
  }
  requireLive("Cruises (CRUISE_API_KEY)");
  return [
    { label: "3-night family getaway", n: 3, base: 540, tags: ["family", "pool", "kids-club", "short"] },
    { label: "4-night Caribbean", n: 4, base: 720, tags: ["family", "pool", "beach-stops"] },
    { label: "7-night grand voyage", n: 7, base: 1450, tags: ["family", "pool", "kids-club", "long"] },
  ].map((c, i) => mk({ id: `cru_${i}_${region}`, type: "cruise", title: `${c.label} (${region})`, supplier: "Cruises", price: money(c.base, `${region}c${i}`), location: region, rating: 4.3, tags: [...c.tags, `${c.n}-night`], simulated: true }));
}
