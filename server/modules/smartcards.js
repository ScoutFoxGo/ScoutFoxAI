// smartcards.js — Smart Cards Automation Engine (Addendum 2.15).
//
// Rule-based generation of daily cards (weather / mood / reward / seasonal /
// packing / tip) with a scheduling step that pins each card to a trip day. The
// rules are deterministic and reliable; an optional AI pass can warm up the copy
// (skipped automatically in mock mode). This is the engine ScoutFoxGo's daily
// "Scout Cards" surface consumes.

import { invokeLLM } from "../llm.js";
import { getTrip, getTripDays } from "../scoutfoxgo/data.js";

const MODEL = "claude_opus_4_8";

function seasonOf(dateStr) {
  const m = new Date(dateStr).getMonth();
  return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "fall";
}

// Build the base cards from rules. Each card: {type, title, body, when, priority}
function ruleCards({ trip, days, weather, mood }) {
  const cards = [];
  const start = trip.start_date;

  if (weather) {
    cards.push({
      type: "weather",
      title: `Weather: ${weather}`,
      body: /rain/i.test(weather)
        ? "Rain expected — pack ponchos and plan an indoor backup."
        : "Clear skies — sunscreen, hats, and a refillable water bottle.",
      when: start,
      priority: 2,
    });
  }
  if (mood) {
    cards.push({
      type: "mood",
      title: `Mood: ${mood}`,
      body: ["tired", "stressed", "low_energy"].includes(mood)
        ? "Build in extra rest today; keep the schedule loose."
        : "Energy's high — a great day to add a bonus activity.",
      when: start,
      priority: 1,
    });
  }
  cards.push({
    type: "seasonal",
    title: `Seasonal tip (${seasonOf(start)})`,
    body: `Make the most of ${seasonOf(start)} in ${trip.destination}.`,
    when: start,
    priority: 3,
  });
  cards.push({
    type: "reward",
    title: "Scout Points",
    body: "Log today's favorite moment in your scrapbook to earn bonus points.",
    when: start,
    priority: 3,
  });
  // One tip card per day, scheduled to that day, from the day's scout_tip.
  for (const d of days) {
    if (d.scout_tip) {
      cards.push({
        type: "tip",
        title: `Day ${d.day_number} tip`,
        body: d.scout_tip,
        when: dayDate(trip, d.day_number),
        priority: 2,
      });
    }
  }
  return cards.sort((a, b) => a.when.localeCompare(b.when) || a.priority - b.priority);
}

function dayDate(trip, dayNumber) {
  const d = new Date(trip.start_date);
  d.setDate(d.getDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

export async function generateCards({ tripId, weather, mood }) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error("trip not found");
  const days = getTripDays(tripId);
  const cards = ruleCards({ trip, days, weather, mood });

  // Optional AI polish of card copy — only when a real model is wired up.
  try {
    const probe = await invokeLLM({ modelKey: MODEL, prompt: "ping", maxTokens: 8 });
    if (!probe.mocked) {
      const res = await invokeLLM({
        modelKey: MODEL,
        maxTokens: 1200,
        prompt:
          `Rewrite each card body to be warmer and more concrete for a family ` +
          `trip to ${trip.destination}. Return ONLY a JSON array of strings, one ` +
          `per card, same order.\nCards:\n${cards.map((c, i) => `${i + 1}. ${c.body}`).join("\n")}`,
      });
      const m = res.text.match(/\[[\s\S]*\]/);
      if (m) {
        const bodies = JSON.parse(m[0]);
        cards.forEach((c, i) => { if (bodies[i]) c.body = bodies[i]; });
      }
    }
  } catch {
    /* keep rule-based copy */
  }

  return { trip: trip.trip_name, count: cards.length, cards };
}
