// digest.js — the weekly review (the "measure behavior + make small improvements
// continuously" engine).
//
// Pulls together what Scout measured (behavior/acceptance from the learning loop,
// what changed via anomalies), what users said (feedback stats + themes), and what
// it learned (distilled insights), then derives a short list of CONCRETE suggested
// improvements to act on this week. Deterministic; optional brain narrative.

import { knowledge, anomalies } from "../learning/loop.js";
import { getLatestInsights } from "../learning/distill.js";
import { feedbackStats } from "./feedback.js";
import { think, availableBrains } from "../llm.js";

// Turn signals into a prioritized list of small, actionable improvements.
function suggestImprovements(k, anoms, fb) {
  const out = [];
  if (!k.interactions) {
    out.push({ priority: "high", signal: "no behavior data yet", action: "Run beta sessions this week — get real families using Scout so the loop has signal." });
  }
  if (fb.responses === 0) {
    out.push({ priority: "high", signal: "no user feedback this week", action: "Talk to 3-5 users and capture a rating + one comment each (POST /api/insights/feedback)." });
  }
  if (fb.avg_rating != null && fb.avg_rating < 3.5) {
    out.push({ priority: "high", signal: `avg rating ${fb.avg_rating}/5`, action: "Review the low-rated sessions and the comment themes; fix the most common complaint first." });
  }
  if (fb.nps_score != null && fb.nps_score < 30) {
    out.push({ priority: "medium", signal: `NPS ${fb.nps_score}`, action: "NPS is soft — interview a detractor and a promoter; ship one fix from each." });
  }
  for (const a of (anoms.flagged || []).slice(0, 3)) {
    out.push({ priority: "medium", signal: `"${a.tag}" swung ${a.swing > 0 ? "+" : ""}${Math.round(a.swing * 100)}% recently`, action: `Investigate what changed for "${a.tag}" (new audience? seasonal? a bad streak?).` });
  }
  for (const r of (k.avoid || []).slice(0, 2)) {
    out.push({ priority: "low", signal: `families skip "${r.tag}" (${Math.round(r.acceptance * 100)}% accept)`, action: `Reconsider when/how "${r.tag}" is recommended, or stop surfacing it for the wrong segments.` });
  }
  for (const t of (fb.themes || []).slice(0, 2)) {
    out.push({ priority: "low", signal: `users keep mentioning "${t.word}" (${t.count}×)`, action: `Dig into "${t.word}" — it's a recurring theme in feedback.` });
  }
  // Always close with the cadence reminder — the actual billion-dollar habit.
  out.push({ priority: "habit", signal: "weekly cadence", action: "Talk to users, measure one behavior, ship one small improvement. Repeat every week." });
  return out;
}

export async function weeklyReview({ windowDays = 7, narrate = false } = {}) {
  const k = knowledge();
  const anoms = anomalies();
  const fb = feedbackStats({ windowDays });
  const insights = getLatestInsights(3);
  const improvements = suggestImprovements(k, anoms, fb);

  const review = {
    generated_at: new Date().toISOString(),
    window_days: windowDays,
    measure_behavior: {
      interactions: k.interactions,
      learned_tags: k.learned_tags,
      works_best: k.works_best?.slice(0, 5),
      avoid: k.avoid?.slice(0, 5),
      by_segment: k.by_segment,
      whats_changed: anoms.flagged,
    },
    talk_to_users: fb,
    what_scout_learned: insights,
    improvements,
  };

  if (narrate && availableBrains().length) {
    try {
      const res = await think({
        maxTokens: 300,
        prompt:
          `Write a 4-6 sentence weekly product update for a founder, warm and concrete, ` +
          `from this data. Lead with momentum, name 1-2 specific improvements to ship this week.\n\n` +
          JSON.stringify({ interactions: k.interactions, avg_rating: fb.avg_rating, nps: fb.nps_score, responses: fb.responses, top: k.works_best?.slice(0, 3), avoid: k.avoid?.slice(0, 2), changed: anoms.flagged?.slice(0, 2), themes: fb.themes?.slice(0, 3) }),
      });
      if (res.text?.trim() && !res.mocked) review.narrative = res.text.trim();
    } catch { /* deterministic review is enough */ }
  }
  return review;
}
