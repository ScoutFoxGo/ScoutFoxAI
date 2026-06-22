// routes.js — LMS API surface, mounted at /api/lms.
import { Router } from "express";
import { listLessons, getLesson, listTopics } from "./corpus.js";
import { distillComparison, learnFromRecent } from "./distill.js";
import { tutor } from "./tutor.js";
import { recordAttempt, recommendNext, progress, dueReviews } from "./learner.js";
import { ingestDocument, knowledgeBase } from "./ingest.js";
import { listCourses, courseOutline, createCourse } from "./courses.js";
import { enroll, nextStep, submit, courseProgress } from "./core.js";

const router = Router();

// --- RAG Knowledge Base admin (ingestion + KB overview) ---
router.post("/ingest", (req, res) => {
  try {
    res.json(ingestDocument(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.get("/kb", (_req, res) => res.json({ documents: knowledgeBase() }));

// --- corpus ---
router.get("/lessons", (_req, res) => res.json({ lessons: listLessons(), topics: listTopics() }));
router.get("/lessons/:id", (req, res) => {
  const l = getLesson(req.params.id);
  return l ? res.json(l) : res.status(404).json({ error: "not found" });
});

// --- self-learning loop ---
router.post("/distill", async (req, res) => {
  const { comparisonId } = req.body || {};
  if (!comparisonId) return res.status(400).json({ error: "comparisonId required" });
  try {
    res.json(await distillComparison(comparisonId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.post("/learn-all", async (_req, res) => {
  try {
    res.json(await learnFromRecent());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- tutor (closed-first; research is opt-in) ---
router.post("/tutor", async (req, res) => {
  const { userId = "anon", question, allowResearch = false } = req.body || {};
  if (!question) return res.status(400).json({ error: "question required" });
  try {
    res.json(await tutor({ userId, question, allowResearch }));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- learner model ---
router.post("/quiz/attempt", (req, res) => {
  const { userId = "anon", lessonId, answers } = req.body || {};
  if (!lessonId) return res.status(400).json({ error: "lessonId required" });
  try {
    res.json(recordAttempt(userId, lessonId, answers || []));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.get("/learner/:userId", (req, res) => res.json(progress(req.params.userId)));
router.get("/learner/:userId/next", (req, res) => res.json(recommendNext(req.params.userId)));
router.get("/learner/:userId/due", (req, res) => res.json({ due: dueReviews(req.params.userId) }));

// --- LMS Core: courses + adaptive path + assessment + certificates ---
router.get("/courses", (_req, res) => res.json({ courses: listCourses() }));
router.post("/courses", (req, res) => {
  try { res.json(createCourse(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get("/courses/:id", (req, res) => {
  const o = courseOutline(req.params.id);
  return o ? res.json(o) : res.status(404).json({ error: "course not found" });
});
router.post("/courses/:id/enroll", (req, res) => {
  const { userId = "anon" } = req.body || {};
  try { res.json(enroll(userId, req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});
// Adaptive next step (lesson + generated quiz, review, or completion).
router.get("/courses/:id/next", async (req, res) => {
  const userId = req.query.userId || "anon";
  try { res.json(await nextStep(userId, req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/courses/:id/submit", (req, res) => {
  const { userId = "anon", lessonId, answers } = req.body || {};
  if (!lessonId) return res.status(400).json({ error: "lessonId required" });
  try { res.json(submit(userId, lessonId, answers || [])); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get("/courses/:id/progress", (req, res) => {
  const userId = req.query.userId || "anon";
  try { res.json(courseProgress(userId, req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
