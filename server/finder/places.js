// places.js — place inventory for the Finder engines (parks, playgrounds,
// beaches, restaurants, cooling-off). Live with a Google Places key (TODO slot),
// labelled mock otherwise, LIVE_ONLY-guarded. One normalized Place shape.
//
// Place: { id, name, category, tags[], price, rating, accessible }

import { requireLive } from "../config.js";

function seed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 1000; }
const rating = (s) => Number((3.8 + (seed(s) % 12) / 10).toFixed(1));

const SETS = {
  parks: [
    { n: "Riverside City Park", tags: ["park", "outdoor", "playground", "shaded", "restroom", "accessible", "budget"], price: 0 },
    { n: "Nature Preserve Trails", tags: ["park", "outdoor", "nature", "hiking", "shaded"], price: 0 },
    { n: "Botanical Garden", tags: ["park", "outdoor", "relaxing", "accessible", "shaded"], price: 12 },
    { n: "State Park & Lake", tags: ["park", "outdoor", "beach", "swimming", "national-park"], price: 8 },
  ],
  playgrounds: [
    { n: "Adventure Playground", tags: ["playground", "outdoor", "active", "shaded"], price: 0 },
    { n: "Inclusive All-Abilities Playground", tags: ["playground", "accessible", "sensory-friendly", "shaded"], price: 0 },
    { n: "Splash Playground", tags: ["playground", "splash", "outdoor", "budget"], price: 0 },
  ],
  beaches: [
    { n: "Family Beach (calm water)", tags: ["beach", "outdoor", "calm-water", "stroller-friendly", "restroom"], price: 0 },
    { n: "Quiet Cove", tags: ["beach", "outdoor", "quiet", "relaxing"], price: 0 },
    { n: "Shelling Beach", tags: ["beach", "outdoor", "shelling", "low-key"], price: 0 },
    { n: "Sunset Point Beach", tags: ["beach", "outdoor", "sunset", "scenic"], price: 0 },
    { n: "Accessible Boardwalk Beach", tags: ["beach", "outdoor", "accessible", "restroom", "shaded"], price: 0 },
  ],
  restaurants: [
    { n: "The Family Table", tags: ["food", "kid-friendly", "highchairs", "casual"], price: 22 },
    { n: "Garden Cafe", tags: ["food", "healthy", "kid-friendly", "shaded", "relaxing"], price: 28 },
    { n: "Quick Bites Counter", tags: ["food", "quick", "budget", "casual"], price: 12 },
    { n: "Farm-to-Table Bistro", tags: ["food", "healthy", "premium"], price: 45 },
  ],
  cooling_off: [
    { n: "Downtown Splash Pad", tags: ["splash", "water", "outdoor", "free", "shaded"], price: 0 },
    { n: "Community Pool", tags: ["pool", "water", "swimming", "budget"], price: 6 },
    { n: "Natural Spring", tags: ["spring", "water", "swimming", "shaded", "nature"], price: 5 },
    { n: "Indoor Water Park", tags: ["water", "indoor", "thrill", "family"], price: 35 },
    { n: "Indoor Aquarium", tags: ["indoor", "aquarium", "educational", "cool", "sensory-friendly"], price: 30 },
  ],
};

export const CATEGORIES = Object.keys(SETS);

export async function searchPlaces({ category, location = "your area" }) {
  if (!SETS[category]) throw new Error(`category must be one of: ${CATEGORIES.join(", ")}`);
  if (process.env.GOOGLE_PLACES_API_KEY) {
    // TODO: real Google Places (Nearby/Text Search) -> normalized Place[].
  }
  requireLive("Places (GOOGLE_PLACES_API_KEY)");
  return SETS[category].map((p, i) => ({
    id: `pl_${category}_${i}`,
    name: `${p.n} — ${location}`,
    category,
    tags: p.tags,
    price: p.price,
    rating: rating(p.n + location),
    accessible: p.tags.includes("accessible"),
    simulated: true,
  }));
}
