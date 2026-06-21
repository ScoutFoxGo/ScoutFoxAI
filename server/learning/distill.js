// distill.js — the PROMPT-BASED half of self-learning.
//
// "Gaining knowledge with prompts": periodically take the raw interaction
// aggregates and ask the model to turn them into a few concise, reusable
// planning insights, then store those in the closed corpus so the tutor and the
// team can use them. Deterministic fallback works offline (mock mode).

import { invokeLLM, researchLLM } from "../llm.js";
import { addLesson, listLessons } from "../lms/corpus.js";
import { SCOUT_SYSTEM_PROMPT } from "../scout/persona.js";
import { knowledge } from "./loop.js";

// INTERNET KNOWLEDGE: pull external knowledge on a topic (Claude web search) and
// distill it into the closed corpus as durable knowledge. Opt-in; live with an
// Anthropic key + network, labelled mock otherwise, LIVE_ONLY-guarded.
export async function researchKnowledge(topic) {
  if (!topic) throw new Error("topic required");
  const r = await researchLLM(topic);
  const lesson = addLesson({
    title: `Researched: ${topic.slice(0, 60)}`,
    topic: "Researched Knowledge",
    summary: r.text,
    key_points: [],
    source: { type: "research", ref: topic },
  });
  return { lesson_id: lesson.id, simulated: !!r.mocked, knowledge: r.text };
}

// The durable knowledge the loop has distilled, newest first — consumed by the
// recommender and the Scout Guide tutor so learning feeds back into answers.
export function getLatestInsights(n = 3) {
  return listLessons()
    .filter((l) => l.topic === "Learned Insights")
    .slice(0, n)
    .map((l) => ({ id: l.id, insight: l.summary, at: l.created_at }));
}

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
