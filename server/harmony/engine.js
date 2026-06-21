// engine.js — Scout Harmony™: the group decision engine.
//
// Balances preferences across several people (a family, friends, coworkers,
// grandparents) and returns Best Fit, a Compromise (makes the least-happy person
// happiest), plus Budget and Premium — with a per-person satisfaction breakdown.
// In-house; scores candidate options against each participant's preferences.

import { gatherOptions } from "../booking/index.js";
import { getFamilyProfile } from "../scoutfoxgo/data.js";

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

function prefsOf(p) {
  if (Array.isArray(p.prefs)) return p.prefs.map(norm);
  if (p.familyProfileId) {
    const f = getFamilyProfile(p.familyProfileId);
    return f ? f.preferences.toLowerCase().split(/[,;]/).map(norm).filter(Boolean) : [];
  }
  return [];
}
function satisfaction(prefs, tags) {
  if (!prefs.length) return 0.6; // neutral when we know nothing about them
  const hits = prefs.filter((p) => tags.some((t) => t.includes(p) || p.includes(t))).length;
  return Math.min(1, hits / Math.min(3, prefs.length));
}

export function harmonize({ participants, destination = "your area", candidates }) {
  if (!Array.isArray(participants) || !participants.length) throw new Error("participants[] required");
  const people = participants.map((p) => ({ name: p.name || "member", prefs: prefsOf(p) }));

  const opts = (candidates && candidates.length
    ? candidates
    : gatherOptions({ destination }).activities
  ).map((o) => ({
    title: o.title,
    // surface the accessible flag as a matchable tag so accessibility-minded
    // participants register against it
    tags: [...(o.tags || []).map(norm), ...(o.accessible ? ["accessible"] : [])],
    price: o.price ?? 0,
  }));

  const scored = opts.map((o) => {
    const per = people.map((pp) => ({ name: pp.name, satisfaction: Number(satisfaction(pp.prefs, o.tags).toFixed(2)) }));
    const group = per.reduce((s, x) => s + x.satisfaction, 0) / people.length;
    const min = Math.min(...per.map((x) => x.satisfaction));
    return { title: o.title, price: o.price, per, group_score: Number(group.toFixed(2)), min_satisfaction: Number(min.toFixed(2)) };
  });

  const bestFit = [...scored].sort((a, b) => b.group_score - a.group_score)[0];
  const compromise = [...scored].sort((a, b) => b.min_satisfaction - a.min_satisfaction || b.group_score - a.group_score)[0];
  const budget = [...scored].sort((a, b) => a.price - b.price)[0];
  const premium = [...scored].sort((a, b) => b.price - a.price)[0];

  return {
    participants: people.map((p) => p.name),
    recommendation: `Best fit for the group: ${bestFit.title} (group ${Math.round(bestFit.group_score * 100)}%). ` +
      `Most balanced compromise: ${compromise.title} (nobody below ${Math.round(compromise.min_satisfaction * 100)}%).`,
    best_fit: bestFit,
    compromise,
    budget_option: budget,
    premium_option: premium,
  };
}
