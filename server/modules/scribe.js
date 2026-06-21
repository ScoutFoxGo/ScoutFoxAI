// scribe.js — Scout Scribe™ (Addendum 2.8).
//
// Turns a completed ScoutFoxGo trip (trip + trip_days + scrapbook entries) into
// a story-style trip report: title, narrative, highlights, per-day captions, and
// themes. Generation via invokeLLM; deterministic fallback for offline mode.

import { invokeLLM } from "../llm.js";
import { getTrip, getTripDays, scrapbookForTrip } from "../scoutfoxgo/data.js";

const MODEL = "claude_opus_4_8";

function fallbackReport(trip, days, scrap) {
  return {
    title: `${trip.trip_name}: A Family Story`,
    story:
      `${trip.summary_text} Over ${days.length} day(s) in ${trip.destination}, ` +
      `${trip.who_is_going} made memories from ${days[0]?.morning_activity || "the first morning"} ` +
      `to ${days[days.length - 1]?.evening_activity || "the trip home"}.`,
    highlights: scrap.map((s) => s.favorite_moment).filter(Boolean),
    captions: days.map((d) => ({
      day_number: d.day_number,
      caption: `Day ${d.day_number}: ${d.morning_activity} → ${d.evening_activity}.`,
    })),
    themes: ["family", trip.trip_type?.toLowerCase() || "travel", trip.destination?.toLowerCase()].filter(Boolean),
  };
}

export async function tripReport({ tripId }) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error("trip not found");
  const days = getTripDays(tripId);
  const scrap = scrapbookForTrip(trip.trip_name);

  const prompt =
    `Write a warm, family-friendly trip report.\n` +
    `Trip: ${trip.trip_name} — ${trip.destination} (${trip.trip_type}). Travelers: ${trip.who_is_going}.\n` +
    `Summary: ${trip.summary_text}\n` +
    `Days:\n${days.map((d) => `Day ${d.day_number}: ${d.morning_activity}, ${d.midday_activity}, ${d.afternoon_activity}, ${d.evening_activity}`).join("\n")}\n` +
    `Favorite moments: ${scrap.map((s) => s.favorite_moment).join("; ") || "(none recorded)"}\n\n` +
    `Return ONLY JSON: {"title":str,"story":str (one warm paragraph),"highlights":[str],` +
    `"captions":[{"day_number":int,"caption":str}],"themes":[str]}`;

  try {
    const res = await invokeLLM({ modelKey: MODEL, prompt, maxTokens: 1800 });
    if (!res.mocked) {
      const m = res.text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.title) return { trip: trip.trip_name, ...parsed, source: "ai" };
      }
    }
  } catch {
    /* fall through */
  }
  return { trip: trip.trip_name, ...fallbackReport(trip, days, scrap), source: "fallback" };
}
