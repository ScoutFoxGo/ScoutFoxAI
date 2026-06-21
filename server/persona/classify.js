// classify.js — Persona & Segmentation engine (Lickly's "Audience Segmentation"
// → Scout's "User Personas"). Classifies a family/user into a planning persona
// and a life stage, and emits recommendation tuning (pace + preferences +
// priorities) that the rest of the system can use. Deterministic and in-house.

import { getFamilyProfile } from "../scoutfoxgo/data.js";
import { getProfile } from "../match/behavior.js";

// Pull ages out of free-text like "Abel: age 3" or "Ava: age 4; Jackson: age 7".
function parseAges(text = "") {
  return [...String(text).matchAll(/age\s*(\d{1,2})/gi)].map((m) => Number(m[1]));
}

// Tuning each life stage implies — fed into the Decision Layer as defaults.
const STAGE_TUNING = {
  "Young Professional": { pace: "adventurous", prefs: ["nightlife", "active", "food"], priorities: ["efficiency"] },
  "New Parent": { pace: "relaxed", prefs: ["stroller-friendly", "shaded", "sensory-friendly"], priorities: ["nap windows", "restrooms", "short walks"] },
  "Family Builder": { pace: "relaxed", prefs: ["stroller-friendly", "playground", "shaded"], priorities: ["rest breaks", "food access", "age-fit"] },
  "Established Family": { pace: "balanced", prefs: ["active", "educational", "outdoor"], priorities: ["variety", "energy pacing"] },
  "Empty Nester": { pace: "balanced", prefs: ["cultural", "food", "relaxing"], priorities: ["comfort"] },
  Retiree: { pace: "relaxed", prefs: ["accessible", "cultural", "relaxing"], priorities: ["accessibility", "rest", "shorter days"] },
};

function lifeStage(ages, hints) {
  if (hints.retiree) return "Retiree";
  if (!ages.length) return hints.empty_nester ? "Empty Nester" : "Young Professional";
  const youngest = Math.min(...ages);
  if (youngest < 2) return "New Parent";
  if (youngest <= 5) return "Family Builder";
  return "Established Family";
}

function persona(ages, adults, hints) {
  if (hints.multigen) return "Multigenerational Organizer";
  if (hints.local) return "Local Explorer";
  if (!ages.length) return adults === 1 ? "Solo Traveler" : "Time-Starved Couple";
  return "Default Planner"; // a parent carrying the planning load
}

// input: { familyProfileId? } or { kids_info?, preferences?, who_is_going?, adults?, userId? }
export function classify(input = {}) {
  const fam = input.familyProfileId ? getFamilyProfile(input.familyProfileId) : null;
  const kidsInfo = input.kids_info || fam?.kids_info || "";
  const prefsText = (input.preferences || fam?.preferences || "").toLowerCase();
  const who = (input.who_is_going || "").toLowerCase();

  const ages = parseAges(kidsInfo);
  const adults = input.adults || (/couple|partner|spouse|wife|husband|two adults|family of/.test(who) ? 2 : 1);
  const hints = {
    multigen: /grandparent|grandma|grandpa|multi-?gen/.test(who),
    retiree: /retire|retiree/.test(who),
    empty_nester: /empty nest/.test(who),
    local: /day trip|local|weekend near|staycation/.test(who),
  };

  const stage = lifeStage(ages, hints);
  const p = persona(ages, adults, hints);
  const tuning = { ...(STAGE_TUNING[stage] || STAGE_TUNING["Established Family"]) };

  // Persona overrides that sharpen the tuning.
  if (p === "Multigenerational Organizer") {
    tuning.pace = "relaxed";
    tuning.prefs = [...new Set([...tuning.prefs, "accessible", "step-free", "rest"])];
    tuning.priorities = [...new Set([...tuning.priorities, "accessibility", "shorter walks"])];
  }
  if (p === "Time-Starved Couple") tuning.pace = "adventurous";

  // Fold in anything the behavior loop already learned.
  const learned = input.userId ? getProfile(input.userId) : null;
  if (learned?.likes?.length) tuning.prefs = [...new Set([...tuning.prefs, ...learned.likes])];

  const traits = [];
  if (ages.length) traits.push(`kids aged ${ages.join(", ")}`);
  traits.push(`${adults} adult${adults > 1 ? "s" : ""}`);
  if (prefsText) traits.push(`states: ${prefsText}`);

  return { persona: p, segment: ages.length ? "Family" : adults > 1 ? "Couple" : "Solo", life_stage: stage, ages, traits, tuning };
}
