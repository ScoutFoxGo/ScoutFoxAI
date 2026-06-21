// learner.js — the per-learner model.
//
// Tracks mastery by topic and drives adaptive learning paths (teach what the
// learner hasn't mastered yet). userId is the join key to ScoutFoxGo identity
// later — same id, shared profile.

import { load, save } from "./jsondb.js";
import { listTopics, listLessons, getLesson } from "./corpus.js";

const FILE = "lms_learners";

export function getLearner(userId) {
  const db = load(FILE, {});
  return db[userId] || { userId, topics: {}, history: [], seen_lessons: [] };
}

function persist(learner) {
  const db = load(FILE, {});
  db[learner.userId] = learner;
  save(FILE, db);
  return learner;
}

// Record a quiz attempt and update mastery for the lesson's topic.
// Mastery is an exponential moving average of correctness in [0,1].
export function recordAttempt(userId, lessonId, answers) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("lesson not found");
  const learner = getLearner(userId);

  const quiz = lesson.quiz || [];
  let correct = 0;
  const results = quiz.map((item, i) => {
    const ok = answers?.[i] === item.answer_index;
    if (ok) correct += 1;
    return { q: item.q, correct: ok, answer_index: item.answer_index, explanation: item.explanation };
  });
  const ratio = quiz.length ? correct / quiz.length : 0;

  const topic = lesson.topic || "General";
  const prev = learner.topics[topic]?.mastery ?? 0;
  const alpha = 0.5; // weight new evidence vs prior
  learner.topics[topic] = {
    mastery: Number((prev * (1 - alpha) + ratio * alpha).toFixed(3)),
    attempts: (learner.topics[topic]?.attempts || 0) + 1,
  };
  if (!learner.seen_lessons.includes(lessonId)) learner.seen_lessons.push(lessonId);
  learner.history.push({ lessonId, topic, ratio, at: new Date().toISOString() });
  persist(learner);

  return { score: ratio, correct, total: quiz.length, results, mastery: learner.topics[topic].mastery };
}

// Adaptive next step: prefer an unseen lesson in the weakest topic; otherwise
// any unseen lesson; otherwise the weakest topic for review.
export function recommendNext(userId) {
  const learner = getLearner(userId);
  const lessons = listLessons();
  if (!lessons.length) return { lesson: null, reason: "corpus is empty — run the self-learning loop first" };

  const topics = listTopics();
  const masteryOf = (t) => learner.topics[t]?.mastery ?? 0;
  const weakTopics = Object.keys(topics).sort((a, b) => masteryOf(a) - masteryOf(b));

  for (const t of weakTopics) {
    const next = lessons.find((l) => l.topic === t && !learner.seen_lessons.includes(l.id));
    if (next) return { lesson: next, reason: `weakest topic: ${t} (mastery ${masteryOf(t)})` };
  }
  const anyUnseen = lessons.find((l) => !learner.seen_lessons.includes(l.id));
  if (anyUnseen) return { lesson: anyUnseen, reason: "new material" };

  const weakest = weakTopics[0];
  const review = lessons.find((l) => l.topic === weakest);
  return { lesson: review || lessons[0], reason: `review weakest topic: ${weakest}` };
}

export function progress(userId) {
  const learner = getLearner(userId);
  return {
    userId,
    topics: learner.topics,
    seen: learner.seen_lessons.length,
    attempts: learner.history.length,
  };
}
