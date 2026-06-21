// engine.js — Finder engines: parks, playgrounds, beaches, restaurants,
// cooling-off. The intelligence stays on: every place is scored with the Scout
// Match Score (match % + confidence band + reasons), personalized to the family
// and the user's learned behavior, then ranked. Not a list — a ranked, explained
// recommendation set.

import { searchPlaces, CATEGORIES } from "./places.js";
import { matchScore } from "../match/score.js";

export const FINDERS = {
  parks: "Park Finder",
  playgrounds: "Playground Finder",
  beaches: "Beach Finder™",
  restaurants: "Restaurant Finder",
  cooling_off: "Cooling Off Finder™",
};

// Heat trigger: when it's hot, steer toward the Cooling Off Finder.
export function isHeat(weather) {
  return /hot|heat|scorch|90|95|100/.test(String(weather || "").toLowerCase());
}

export async function find({ category, location, familyProfileId, userId, criteria }) {
  if (!CATEGORIES.includes(category)) throw new Error(`category must be one of: ${CATEGORIES.join(", ")}`);
  let places = await searchPlaces({ category, location });

  // Optional extra criteria (e.g. Beach Finder: "toddlers", "shelling", "sunset",
  // "quiet", "accessible") — bias toward places carrying that tag.
  const crit = (criteria || "").toLowerCase().trim().replace(/\s+/g, "-");

  const ranked = await Promise.all(
    places.map(async (p) => {
      const m = await matchScore({ title: p.name, tags: p.tags, price: p.price }, { familyProfileId, userId });
      let score = m.match_score;
      if (crit && p.tags.some((t) => t.includes(crit) || crit.includes(t))) score = Math.min(100, score + 12);
      return { name: p.name, rating: p.rating, price: p.price ? `$${p.price}` : "Free", tags: p.tags, match_score: score, band: m.band, reasons: m.reasons };
    })
  );
  ranked.sort((a, b) => b.match_score - a.match_score);

  return {
    finder: FINDERS[category],
    location: location || "your area",
    criteria: criteria || null,
    top_pick: ranked[0] || null,
    results: ranked,
  };
}
