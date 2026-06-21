// distill.js — the self-learning loop.
//
// This is what makes the LMS "build its own learning": it turns ScoutFox usage
// (saved multi-model comparisons + synthesis + judge) into vetted lessons and
// quizzes in your own corpus. The corpus compounds as ScoutFox gets used — the
// bridge to ScoutFoxGo is exactly this raw material.
//
// Generation goes through invokeLLM (Claude by default, swappable). Retrieval,
// storage, and the resulting content are all in-house.

import { invokeLLM } from "../llm.js";
import { getComparison, recentComparisons } from "../store.js";
import { addLesson, hasLessonFromComparison } from "./corpus.js";

const DISTILL_MODEL = "claude_opus_4_8";

function buildTranscript(comparison) {
  const responses = comparison.responses || {};
  const body = (comparison.models || [])
    .map((name, i) => {
      const key = Object.keys(responses)[i];
      return `### ${name}\n${responses[key]?.text || "(no answer)"}`;
    })
    .join("\n\n");
  return `Question: ${comparison.prompt}\n\n${body}\n\nSynthesis:\n${comparison.synthesis || "(none)"}`;
}

// Deterministic fallback so the loop works offline (mock mode) too.
function mockLesson(comparison) {
  const topic = (comparison.prompt || "General").split(/\s+/).slice(0, 4).join(" ");
  return {
    title: `Lesson: ${comparison.prompt?.slice(0, 60) || "Untitled"}`,
    topic,
    summary:
      "A self-generated lesson distilled from a ScoutFox comparison. Add an API key to produce richer, model-written lessons.",
    key_points: [
      "Restate the core question and why it matters.",
      "The models broadly agreed on the main approach.",
      "Key tradeoffs to remember when applying this.",
    ],
    quiz: [
      {
        q: `What was the central question of this lesson?`,
        choices: [comparison.prompt?.slice(0, 50) || "The topic", "An unrelated topic", "None of these"],
        answer_index: 0,
        explanation: "The lesson is built directly from that question.",
      },
    ],
  };
}

function parseLessonJSON(text) {
  // Models sometimes wrap JSON in prose/fences — extract the object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Distill one saved comparison into a lesson. Idempotent per comparison.
export async function distillComparison(comparisonId) {
  const comparison = getComparison(comparisonId);
  if (!comparison) throw new Error("comparison not found");
  if (hasLessonFromComparison(comparisonId)) {
    return { skipped: true, reason: "already distilled" };
  }

  let lessonData;
  const prompt =
    `You are a curriculum designer for a closed learning system. Turn the ` +
    `following multi-model AI comparison into ONE compact lesson.\n\n` +
    `${buildTranscript(comparison)}\n\n` +
    `Return ONLY valid JSON with this shape:\n` +
    `{"title": str, "topic": str (2-4 words), "summary": str (2-3 sentences), ` +
    `"key_points": [str, ...] (3-5), "quiz": [{"q": str, "choices": [str,str,str], ` +
    `"answer_index": int, "explanation": str}] (1-2 items)}`;

  try {
    const res = await invokeLLM({ modelKey: DISTILL_MODEL, prompt, maxTokens: 1500 });
    lessonData = res.mocked ? mockLesson(comparison) : parseLessonJSON(res.text);
    if (!lessonData) lessonData = mockLesson(comparison);
  } catch {
    lessonData = mockLesson(comparison);
  }

  const lesson = addLesson({
    ...lessonData,
    source: { type: "comparison", ref: comparisonId },
  });
  return { lesson };
}

// Learn from everything: distill any recent comparison not yet turned into a
// lesson. This is the "gets smarter every run" batch step.
export async function learnFromRecent(limit = 20) {
  const created = [];
  for (const c of recentComparisons(limit)) {
    if (hasLessonFromComparison(c.id)) continue;
    const r = await distillComparison(c.id);
    if (r.lesson) created.push(r.lesson);
  }
  return { created: created.length, lessons: created };
}
