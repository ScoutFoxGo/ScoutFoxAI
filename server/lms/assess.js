// assess.js — assessment for the LMS Core.
//
// Turns a lesson into a multiple-choice quiz so mastery can be measured. Uses
// Scout's own brain (Claude OR OpenAI via think()) to generate questions from the
// lesson, then CACHES them on the lesson so it's only generated once. A fully
// deterministic fallback runs offline (no provider) by building questions from the
// lesson's key points / summary against distractors drawn from other lessons — so
// every lesson is always quizzable.

import { think, availableBrains } from "../llm.js";
import { listLessons, updateLesson } from "./corpus.js";
import { SCOUT_SYSTEM_PROMPT } from "../scout/persona.js";

// Quiz item: { q, choices[4], answer_index, explanation }
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function points(lesson) {
  const kps = (lesson.key_points || []).map((s) => String(s).trim()).filter((s) => s.length > 4);
  if (kps.length) return kps;
  return String(lesson.summary || "")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 3);
}

// Deterministic, offline quiz: each correct answer is a key point of THIS lesson;
// distractors are key points from OTHER lessons (or generic if the corpus is thin).
function fallbackQuiz(lesson) {
  const correctPool = points(lesson);
  if (!correctPool.length) return [];
  const others = listLessons().filter((l) => l.id !== lesson.id);
  const distractorPool = [...new Set(others.flatMap((l) => points(l)))].filter((p) => !correctPool.includes(p));
  const generic = ["Skip planning and decide on the day", "Always pick the cheapest option regardless of fit", "Ignore the family's stated preferences"];

  return correctPool.slice(0, 3).map((correct, i) => {
    const ds = seededShuffle(distractorPool, lesson.id + i).slice(0, 3);
    while (ds.length < 3) ds.push(generic[ds.length]);
    const choices = seededShuffle([correct, ...ds], lesson.id + "c" + i);
    return {
      q: `Which of these best reflects "${lesson.topic}" (${lesson.title})?`,
      choices,
      answer_index: choices.indexOf(correct),
      explanation: `Grounded in: ${lesson.title}.`,
    };
  });
}

async function generateQuiz(lesson) {
  const ctx = `${lesson.title}\nTopic: ${lesson.topic}\n${lesson.summary}\nKey points: ${(lesson.key_points || []).join("; ")}`;
  const res = await think({
    maxTokens: 700,
    system: SCOUT_SYSTEM_PROMPT,
    prompt:
      `Write 3 multiple-choice questions that check understanding of this lesson. ` +
      `Return ONLY JSON: [{"q":str,"choices":[str,str,str,str],"answer_index":int,"explanation":str}]. ` +
      `Base every question and the correct answer strictly on the lesson; make distractors plausible but wrong.\n\nLesson:\n${ctx}`,
  });
  if (res.mocked) return null;
  const m = res.text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  const arr = JSON.parse(m[0]);
  return arr
    .filter((x) => x && x.q && Array.isArray(x.choices) && x.choices.length >= 2 && Number.isInteger(x.answer_index))
    .map((x) => ({ q: String(x.q), choices: x.choices.map(String), answer_index: Math.max(0, Math.min(x.choices.length - 1, x.answer_index)), explanation: String(x.explanation || "") }));
}

// Get (or build + cache) a quiz for a lesson. Always returns an array.
export async function quizFor(lesson) {
  if (lesson.quiz && lesson.quiz.length) return lesson.quiz;
  let quiz = null;
  if (availableBrains().length) {
    try { quiz = await generateQuiz(lesson); } catch { /* fall through */ }
  }
  if (!quiz || !quiz.length) quiz = fallbackQuiz(lesson);
  if (quiz.length) updateLesson(lesson.id, { quiz }); // learn it once
  return quiz;
}
