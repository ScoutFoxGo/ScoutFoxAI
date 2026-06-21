// admin.js — Administrative AI Tools (Addendum 2.9).
//
// AI analytics dashboard data, a session viewer, a feedback manager, and trace
// logs — the data the Next.js admin dashboard consumes. All in-house (reads the
// existing JSON stores; appends a lightweight trace + feedback log).

import { load, save } from "../lms/jsondb.js";
import { recentComparisons } from "../store.js";
import { listLessons, listTopics } from "../lms/corpus.js";
import { knowledgeBase } from "../lms/ingest.js";

const TRACES = "admin_traces";
const FEEDBACK = "admin_feedback";
const TRACE_CAP = 500;

// --- trace log: other code calls logTrace() to record an AI event ---
export function logTrace(event) {
  const log = load(TRACES, []);
  log.push({ at: new Date().toISOString(), ...event });
  if (log.length > TRACE_CAP) log.splice(0, log.length - TRACE_CAP);
  save(TRACES, log);
}
export function listTraces(limit = 100) {
  return load(TRACES, []).slice(-limit).reverse();
}

// --- feedback manager ---
export function recordFeedback({ userId = "anon", target, value, note }) {
  if (!value) throw new Error("value required (helpful | not_helpful | saved)");
  const fb = load(FEEDBACK, []);
  const entry = { id: fb.length + 1, userId, target: target || null, value, note: note || "", at: new Date().toISOString() };
  fb.push(entry);
  save(FEEDBACK, fb);
  return entry;
}
export function listFeedback() {
  return load(FEEDBACK, []).slice().reverse();
}

// --- session viewer: recent comparisons treated as sessions ---
export function sessions(limit = 50) {
  return recentComparisons(limit).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    tier: c.tier,
    models: c.models,
    created_at: c.created_at,
  }));
}

// --- analytics dashboard data ---
export function analytics() {
  const lessons = listLessons();
  const traces = load(TRACES, []);
  const feedback = load(FEEDBACK, []);
  const learners = Object.values(load("lms_learners", {}));

  const byProvider = {};
  let mocked = 0;
  for (const t of traces) {
    if (t.model) byProvider[t.model] = (byProvider[t.model] || 0) + 1;
    if (t.mocked) mocked += 1;
  }
  const researchAnswers = lessons.filter((l) => l.source?.type === "research").length;
  const fbCounts = feedback.reduce((a, f) => ((a[f.value] = (a[f.value] || 0) + 1), a), {});

  return {
    corpus: { lessons: lessons.length, topics: Object.keys(listTopics()).length, documents: knowledgeBase().length, from_research: researchAnswers },
    learners: { count: learners.length, attempts: learners.reduce((s, l) => s + (l.history?.length || 0), 0) },
    ai_calls: { total: traces.length, mocked, by_model: byProvider },
    feedback: { total: feedback.length, ...fbCounts },
    sessions: recentComparisons(1000).length,
  };
}
