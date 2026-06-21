// tutor.js — the closed-corpus tutor, with an optional research fallback.
//
// Default behavior is CLOSED: it answers strictly from your own corpus and, if
// the corpus doesn't cover the question, it says so rather than guessing.
//
// When `allowResearch` is true, a miss triggers a single external research step
// (web search via researchLLM). Crucially, the result is DISTILLED BACK INTO
// THE CORPUS as a new lesson — so the system "learns" it and the next identical
// question is answered in-house, with no external call. Research is the
// exception that grows the closed knowledge base, not a standing dependency.

import { invokeLLM, researchLLM } from "../llm.js";
import { searchCorpus, addLesson } from "./corpus.js";

const TUTOR_MODEL = "claude_opus_4_8";

function topicFrom(question) {
  return question.split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join(" ") || "General";
}

export async function tutor({ userId, question, allowResearch = false }) {
  let lessons = searchCorpus(question, 4);
  let researched = false;
  let newLesson = null;

  // Corpus miss + research allowed → research, then absorb into the corpus.
  if (lessons.length === 0 && allowResearch) {
    const note = await researchLLM(question);
    newLesson = addLesson({
      title: `Researched: ${question.slice(0, 60)}`,
      topic: topicFrom(question),
      summary: note.text,
      key_points: [],
      source: { type: "research", ref: question },
    });
    lessons = [newLesson];
    researched = true;
  }

  // Still nothing and not allowed to research → honest "I don't know yet".
  if (lessons.length === 0) {
    return {
      grounded: false,
      researched: false,
      answer:
        "I don't have anything in my knowledge base on that yet. Turn on research " +
        "to let me look it up and save it for next time, or add a lesson on this topic.",
      citations: [],
    };
  }

  // Answer grounded ONLY in the retrieved lessons. The prompt forbids going
  // beyond them, which is what keeps a corpus answer closed.
  const context = lessons
    .map((l) => `[${l.id}] ${l.title}\n${l.summary}\n${(l.key_points || []).join("; ")}`)
    .join("\n\n");
  const prompt =
    `Answer the question using ONLY the lessons below. If they don't fully cover ` +
    `it, say what's missing rather than inventing. Cite the lesson ids you use, ` +
    `like [${lessons[0].id}].\n\nLessons:\n${context}\n\nQuestion: ${question}`;

  const res = await invokeLLM({ modelKey: TUTOR_MODEL, prompt });
  return {
    grounded: true,
    researched,
    answer: res.text,
    citations: lessons.map((l) => ({ id: l.id, title: l.title, source: l.source?.type })),
    new_lesson: newLesson ? { id: newLesson.id, title: newLesson.title } : null,
  };
}
