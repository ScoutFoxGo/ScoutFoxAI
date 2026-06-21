// mood.js — Mood AI (Addendum 2.6).
//
// Reshapes a ScoutFoxGo itinerary (real trip_days) to match the family's mood
// and preferences: lower energy → more rest + shorter blocks, adventurous →
// bonus activities, plus a supportive tone note. Generation runs through the
// swappable invokeLLM seam; a deterministic rule-based fallback keeps it working
// offline (mock mode).

import { invokeLLM } from "../llm.js";
import { getTrip, getTripDays, getFamilyProfile } from "../scoutfoxgo/data.js";

const MODEL = "claude_opus_4_8";
const SLOTS = ["morning_activity", "midday_activity", "afternoon_activity", "evening_activity"];

const TONE = {
  tired: "Gentle and low-pressure — plenty of rest, no rushing.",
  stressed: "Calm and reassuring — fewer choices, more downtime.",
  low_energy: "Easygoing — shorter blocks and built-in breaks.",
  excited: "Upbeat and playful — lean into the fun.",
  adventurous: "Bold and exploratory — add a stretch goal each day.",
  calm: "Relaxed and unhurried.",
};

function ruleAdapt(days, mood) {
  const lowEnergy = ["tired", "stressed", "low_energy", "calm"].includes(mood);
  return days.map((d) => {
    const out = { day_number: d.day_number };
    for (const s of SLOTS) {
      let v = d[s] || "";
      if (lowEnergy && s === "afternoon_activity") v = `Rest / quiet time (was: ${v})`;
      if (!lowEnergy && s === "evening_activity") v = `${v} + optional bonus explore`;
      out[s.replace("_activity", "")] = v;
    }
    out.note = lowEnergy ? "Slower pace, extra breaks." : "Energetic pace with a bonus.";
    return out;
  });
}

export async function adaptItinerary({ tripId, mood = "calm", familyProfileId }) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error("trip not found");
  const days = getTripDays(tripId);
  const fam = familyProfileId ? getFamilyProfile(familyProfileId) : null;
  const tone = TONE[mood] || TONE.calm;

  const prompt =
    `Adapt this family itinerary to the mood "${mood}".\n` +
    `Trip: ${trip.trip_name} (${trip.destination}). ` +
    (fam ? `Family prefs: ${fam.preferences}.\n` : "\n") +
    `Days:\n${days
      .map(
        (d) =>
          `Day ${d.day_number}: AM ${d.morning_activity}; MID ${d.midday_activity}; PM ${d.afternoon_activity}; EVE ${d.evening_activity}`
      )
      .join("\n")}\n\n` +
    `Return ONLY JSON: {"tone": str, "days":[{"day_number":int,"morning":str,` +
    `"midday":str,"afternoon":str,"evening":str,"note":str}]}. Honor the family prefs.`;

  try {
    const res = await invokeLLM({ modelKey: MODEL, prompt, maxTokens: 1500 });
    if (!res.mocked) {
      const m = res.text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.days) return { trip: trip.trip_name, mood, tone: parsed.tone || tone, days: parsed.days, source: "ai" };
      }
    }
  } catch {
    /* fall through to rules */
  }
  return { trip: trip.trip_name, mood, tone, days: ruleAdapt(days, mood), source: "rules" };
}
