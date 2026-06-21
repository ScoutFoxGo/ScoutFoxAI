// intel.js — Destination Intelligence (Lickly's "Competitive Intelligence" →
// Scout's "Destination Intelligence"). Structured read on a destination —
// sentiment, family-fit, what it's best for, likely pain points, best season —
// plus head-to-head comparison for a specific family. Builds on the destinations
// data, the community-signals adapter, and the Scout Match Score.

import { getDestination } from "../scoutfoxgo/data.js";
import { communitySentiment } from "../match/signals.js";
import { matchScore, band } from "../match/score.js";

// Map description keywords -> "best for" tags (in-house; live sources enrich later).
const KEYWORDS = {
  beach: ["beach", "beaches", "shore", "coast"],
  park: ["park", "parks"],
  zoo: ["zoo", "aquarium", "wildlife"],
  "theme parks": ["theme park", "amusement"],
  food: ["food", "cuisine", "dining", "bakeries", "restaurant"],
  culture: ["museum", "culture", "historic", "architecture", "art"],
  outdoors: ["hike", "trail", "mountain", "nature", "sunshine"],
  family: ["family", "kid", "children"],
};
// Typical pain points by what a place is known for.
const PAIN = {
  "theme parks": ["crowds and long lines", "high ticket prices", "long days that tire little kids"],
  beach: ["midday heat", "parking near the shore", "sun exposure"],
  culture: ["lots of walking", "tickets/timed entry"],
  food: ["wait times at popular spots"],
};

function tagsFromDescription(desc = "") {
  const d = desc.toLowerCase();
  return Object.entries(KEYWORDS).filter(([, ws]) => ws.some((w) => d.includes(w))).map(([t]) => t);
}
function painFor(tags) {
  const out = [];
  for (const t of tags) if (PAIN[t]) out.push(...PAIN[t]);
  return [...new Set(out)].slice(0, 3);
}
function bestSeason(tags) {
  if (tags.includes("beach")) return "late spring to early fall — warm, but plan around midday heat (estimate, verify)";
  if (tags.includes("theme parks")) return "spring or fall — milder weather and smaller crowds (estimate, verify)";
  return "spring or fall are usually mild — verify for your dates";
}

export async function intel(name, subject = {}) {
  const dest = getDestination(name);
  const description = dest?.description || "";
  const tags = tagsFromDescription(description);

  const sent = await communitySentiment(name);
  const fit = await matchScore({ title: name, tags }, subject); // family-fit via Match Score

  return {
    destination: dest?.name || name,
    region: dest?.region || null,
    country: dest?.country || null,
    sentiment: { score: Number(sent.score.toFixed(2)), simulated: sent.simulated },
    family_fit: { score: fit.match_score, band: fit.band, reasons: fit.reasons },
    best_for: tags.length ? tags : ["general travel"],
    pain_points: painFor(tags).length ? painFor(tags) : ["check local conditions before you go"],
    best_season: bestSeason(tags),
    note: sent.simulated ? "Sentiment is a neutral placeholder until community-signal sources are configured." : undefined,
  };
}

// Head-to-head for a specific family — picks one and explains (Scout style).
export async function compare(a, b, subject = {}) {
  const [ia, ib] = await Promise.all([intel(a, subject), intel(b, subject)]);
  const winner = ia.family_fit.score >= ib.family_fit.score ? ia : ib;
  const loser = winner === ia ? ib : ia;
  const recommendation =
    `For your family, I recommend ${winner.destination} (${winner.family_fit.score}% — ${winner.family_fit.band}) over ` +
    `${loser.destination} (${loser.family_fit.score}%). ${winner.destination} is strong for ${winner.best_for.join(", ")}; ` +
    `just plan around ${winner.pain_points[0] || "local conditions"}.`;
  return { recommendation, options: [ia, ib], confidence: band(winner.family_fit.score) };
}
