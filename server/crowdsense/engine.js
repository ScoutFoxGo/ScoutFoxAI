// engine.js — Scout CrowdSense™: predict crowds, wait times, and the best day/
// time to go. In-house heuristics (day-of-week, season, holidays, venue type) —
// no external data needed; sharpens with real signals later.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Approximate big US crowd days (month is 1-based here).
function isHoliday(d) {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 1 && day === 1) return true;          // New Year's
  if (m === 7 && day === 4) return true;           // July 4
  if (m === 12 && day >= 23 && day <= 31) return true; // Christmas week
  if (m === 11 && d.getDay() === 4 && day >= 22 && day <= 28) return true; // Thanksgiving
  if ((m === 5 || m === 9) && d.getDay() === 1 && day >= 25) return true;  // Memorial/Labor-ish
  return false;
}

export function predictCrowd({ place = "venue", tags = [], date } = {}) {
  const d = date ? new Date(date) : new Date();
  const dow = d.getDay();
  let score = 30;
  if (dow === 0 || dow === 6) score += 35;
  else if (dow === 5) score += 20;
  else score += 5;

  const month = d.getMonth();
  const summer = month >= 5 && month <= 7;
  const outdoorish = tags.some((t) => ["outdoor", "beach", "park", "theme park", "splash"].includes(t));
  if (summer && outdoorish) score += 15;
  if (tags.includes("theme park") || /theme park|disney|universal/i.test(place)) score += 20;
  if (isHoliday(d)) score += 25;
  score = Math.min(100, score);

  const level = score >= 80 ? "very_high" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";
  return {
    place,
    date: d.toISOString().slice(0, 10),
    day: DOW[dow],
    crowd_score: score,
    level,
    wait_estimate_min: Math.round(score * 0.9),
    best_time: level === "low" ? "anytime" : "right at opening, or after 3pm",
  };
}

// Best day to go over the next N days.
export function bestDay({ place = "venue", tags = [], from, days = 7 } = {}) {
  const start = from ? new Date(from) : new Date();
  const all = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    all.push(predictCrowd({ place, tags, date: d.toISOString().slice(0, 10) }));
  }
  const sorted = [...all].sort((a, b) => a.crowd_score - b.crowd_score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  return {
    place,
    recommendation: `Go ${best.day} (${best.date}) — predicted ${best.level} crowds (~${best.wait_estimate_min} min waits). ` +
      `Avoid ${worst.day} (${worst.level}). Arrive ${best.best_time}.`,
    best,
    by_day: all,
  };
}
