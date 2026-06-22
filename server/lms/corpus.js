// corpus.js — the LMS's own knowledge base.
//
// This is the "closed content" layer: every lesson lives in your store, never
// pulled from an external site. Retrieval is in-house keyword scoring (no
// third-party embedding API), so the tutor can ground answers in owned content
// with zero external dependencies.

import { randomUUID } from "node:crypto";
import { load, save } from "./jsondb.js";

const FILE = "lms_corpus";

// A lesson:
// { id, title, topic, summary, key_points[], quiz[{q,choices[],answer_index,explanation}],
//   source: {type, ref}, created_at }
export function addLesson(lesson) {
  const db = load(FILE, {});
  const id = randomUUID().slice(0, 8);
  const saved = {
    id,
    created_at: new Date().toISOString(),
    quiz: [],
    key_points: [],
    ...lesson,
  };
  db[id] = saved;
  save(FILE, db);
  return saved;
}

export function getLesson(id) {
  return load(FILE, {})[id] || null;
}

// Patch an existing lesson (e.g. cache a generated quiz). Returns the updated
// lesson or null if it doesn't exist.
export function updateLesson(id, patch = {}) {
  const db = load(FILE, {});
  if (!db[id]) return null;
  db[id] = { ...db[id], ...patch, id, updated_at: new Date().toISOString() };
  save(FILE, db);
  return db[id];
}

export function listLessons() {
  return Object.values(load(FILE, {})).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );
}

export function listTopics() {
  const counts = {};
  for (const l of Object.values(load(FILE, {}))) {
    counts[l.topic] = (counts[l.topic] || 0) + 1;
  }
  return counts;
}

// Has a comparison already been distilled into a lesson? Keeps the
// self-learning loop idempotent so re-running doesn't duplicate lessons.
export function hasLessonFromComparison(comparisonId) {
  return Object.values(load(FILE, {})).some(
    (l) => l.source?.type === "comparison" && l.source?.ref === comparisonId
  );
}

const STOP = new Set(
  "a an the and or but of to in on for with is are was were be been being this that these those it its as at by from".split(
    " "
  )
);

function tokenize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function lessonText(l) {
  return [l.title, l.topic, l.summary, (l.key_points || []).join(" ")].join(" ");
}

// In-house retrieval: TF score with light IDF weighting across the corpus.
// Returns the top-k lessons most relevant to `query`.
export function searchCorpus(query, k = 4) {
  const lessons = Object.values(load(FILE, {}));
  if (!lessons.length) return [];

  const docs = lessons.map((l) => ({ lesson: l, tokens: tokenize(lessonText(l)) }));
  const N = docs.length;
  const df = {};
  for (const d of docs) {
    for (const t of new Set(d.tokens)) df[t] = (df[t] || 0) + 1;
  }
  const qTerms = tokenize(query);

  const scored = docs.map(({ lesson, tokens }) => {
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    let score = 0;
    for (const q of qTerms) {
      if (tf[q]) {
        const idf = Math.log(1 + N / (df[q] || 1));
        score += tf[q] * idf;
      }
    }
    return { lesson, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.lesson);
}
