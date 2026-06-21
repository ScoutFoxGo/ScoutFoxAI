// routes.js — Match & Confidence subsystem, mounted at /api/match.
import { Router } from "express";
import { recordSignal, getProfile } from "./behavior.js";
import { matchScore, rankByMatch } from "./score.js";
import { predict } from "./predict.js";
import { communitySentiment } from "./signals.js";

const router = Router();

// Scout Match Score + Decision Confidence band for one target.
// Body: { target:{title,tags[],kind?,price?}, userId?, familyProfileId? }
// Accept the subject either flat on the body or nested under `subject`, and carry
// segment/weather/context so cold-start + context-aware learning kick in.
function subjectOf(body = {}) {
  const s = body.subject || {};
  return {
    userId: body.userId ?? s.userId,
    familyProfileId: body.familyProfileId ?? s.familyProfileId,
    segment: body.segment ?? s.segment,
    weather: body.weather ?? s.weather,
    context: body.context ?? s.context,
    explore: body.explore ?? s.explore,
  };
}

router.post("/score", async (req, res) => {
  const target = req.body?.target;
  if (!target) return res.status(400).json({ error: "target required" });
  try {
    res.json(await matchScore(target, subjectOf(req.body)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Rank many targets by match. Body: { targets:[...], userId?, familyProfileId? }
router.post("/rank", async (req, res) => {
  const targets = req.body?.targets;
  if (!Array.isArray(targets)) return res.status(400).json({ error: "targets[] required" });
  try {
    res.json({ ranked: await rankByMatch(targets, subjectOf(req.body)) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Experience Prediction ("Families like yours rated this X%").
router.post("/predict", async (req, res) => {
  const target = req.body?.target;
  if (!target) return res.status(400).json({ error: "target required" });
  try {
    res.json(await predict(target, subjectOf(req.body)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Behavior Learning Loop — record a like/dislike/budget/accept/reject signal.
// Body: { userId, signal:{type, value?, tags?, title?, rating?} }
router.post("/behavior", (req, res) => {
  const { userId, signal } = req.body || {};
  if (!userId || !signal) return res.status(400).json({ error: "userId and signal required" });
  try {
    res.json(recordSignal(userId, signal));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.get("/behavior/:userId", (req, res) => res.json(getProfile(req.params.userId)));

// Community Signals (mock in dev; live when configured).
router.get("/signals", async (req, res) => {
  try {
    res.json(await communitySentiment(req.query.q || ""));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
