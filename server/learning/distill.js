// distill.js — the PROMPT-BASED half of self-learning.
//
// "Gaining knowledge with prompts": periodically take the raw interaction
// aggregates and ask the model to turn them into a few concise, reusable
// planning insights, then store those in the closed corpus so the tutor and the
// team can use them. Deterministic fallback works offline (mock mode).

import { invokeLLM } from "../llm.js";
import { addLesson } from "../lms/corpus.js";
import { SCOUT_SYSTEM_PROMPT } from "../scout/persona.js";
import { knowledge } from "./loop.js";

export async function learnInsights() {
  const k = knowledge();
  if (!k.interactions) return { created: 0, note: "no interactions yet — nothing to learn from" };

  const works = k.works_best.map((r) => `${r.tag} (${Math.round(r.acceptance * 100)}%)`).join(", ");
  const avoid = k.avoid.map((r) => `${r.tag} (${Math.round(r.acceptance * 100)}%)`).join(", ");
  let insight = `Across ${k.interactions} interactions, families accept most: ${works}.` + (avoid ? ` They tend to skip: ${avoid}.` : "");

  // Prompt-based refinement when a real model is wired up.
  try {
    const probe = await invokeLLM({ modelKey: "claude_opus_4_8", prompt: "ping", maxTokens: 8 });
    if (!probe.mocked) {
      const res = await invokeLLM({
        modelKey: "claude_opus_4_8",
        maxTokens: 400,
        system: SCOUT_SYSTEM_PROMPT,
        prompt:
          `From this acceptance data, write 2-3 concise, reusable planning insights ` +
          `for future family recommendations.\nWorks best: ${works}\nSkipped: ${avoid || "(none yet)"}`,
      });
      if (res.text?.trim()) insight = res.text.trim();
    }
  } catch {
    /* keep the deterministic insight */
  }

  const lesson = addLesson({
    title: `Learned insight — ${new Date().toISOString().slice(0, 10)}`,
    topic: "Learned Insights",
    summary: insight,
    key_points: [],
    source: { type: "learning", ref: `${k.interactions} interactions` },
  });
  return { created: 1, insight, lesson_id: lesson.id };
}
