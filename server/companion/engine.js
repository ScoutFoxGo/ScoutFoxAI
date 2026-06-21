// engine.js — Scout Companion™: proactive, context-aware trip alerts.
//
// Turns a trip + conditions into the kind of nudges the PRD's "predictive
// intelligence" describes: rain -> indoor swap, heat -> cooling tips, rest
// windows for little kids, packing reminders, and crowd timing. In-house rules
// over the trip data; deterministic and testable.

import { getTrip, getTripDays, packingList } from "../scoutfoxgo/data.js";
import { bestDay } from "../crowdsense/engine.js";

const OUTDOOR = /(beach|park|playground|zoo|safari|splash|garden|stroll|picnic|lawn|walk|pool)/i;
const alert = (type, severity, message, when) => ({ type, severity, message, when: when || null });

export function tripAlerts({ tripId, weather = "", now } = {}) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error("trip not found");
  const days = getTripDays(tripId);
  const w = String(weather).toLowerCase();
  const alerts = [];

  // Weather: rain -> swap outdoor blocks for indoor
  if (/rain|storm|thunder/.test(w)) {
    for (const d of days) {
      const slot = ["morning_activity", "midday_activity", "afternoon_activity", "evening_activity"].find((s) => OUTDOOR.test(d[s] || ""));
      if (slot) {
        alerts.push(alert("weather", "high", `Rain expected — Day ${d.day_number}'s "${d[slot]}" is outdoor. Swap for an indoor pick (museum/aquarium) and keep ponchos handy.`, `day ${d.day_number}`));
        break;
      }
    }
  }
  // Heat tips
  if (/hot|heat|90|95|100/.test(w)) {
    alerts.push(alert("heat", "high", "Heat advisory — front-load outdoor time before 11am, seek shade midday, and freeze water bottles overnight.", "all days"));
  }

  // Rest window for little kids
  if (/(age [0-4]\b|toddler|age 3|age 4|age 5)/i.test(trip.who_is_going || "")) {
    alerts.push(alert("rest", "medium", "Little ones along — protect an early-afternoon nap/quiet window so the day doesn't tip into a meltdown.", "midday"));
  }

  // Packing reminder by trip type / destination
  const beachy = /beach|miami|coast|island/i.test(`${trip.destination} ${trip.trip_type}`);
  const items = packingList().filter((p) => (beachy ? p.category === "Beach" : p.category === "Kid Essentials")).map((p) => p.item).slice(0, 3);
  if (items.length) alerts.push(alert("packing", "low", `Don't forget: ${items.join(", ")}.`, "before you go"));

  // Crowd timing for the destination
  const crowd = bestDay({ place: trip.destination, tags: ["family"], from: trip.start_date, days: 5 });
  alerts.push(alert("crowds", "low", crowd.recommendation, "planning"));

  // Leave-by nudge for day 1
  if (days[0]) alerts.push(alert("timing", "medium", `Day 1 starts with "${days[0].morning_activity}" — leave early to beat lines and parking.`, "day 1 morning"));

  return { trip: trip.trip_name, weather: weather || "n/a", count: alerts.length, alerts };
}
