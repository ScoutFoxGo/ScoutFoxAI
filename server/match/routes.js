// routes.js — Match & Confidence subsystem, mounted at /api/match.
import { Router } from "express";
import { recordSignal, getProfile } from "./behavior.js";
import { matchScore, rankByMatch } from "./score.js";
import { predict } from "./predict.js";
import { communitySentiment } from "./signals.js";

const router = Router();

// Scout Match Score + Decision Confidence band for one target.
// Body: { target:{title,tags[],kind?,price?}, userId?, familyProfileId? }
router.post("/score", async (req, res) => {
  const { target, userId, familyProfileId } = req.body || {};
  if (!target) return res.status(400).json({ error: "target required" });
  try {
    res.json(await matchScore(target, { userId, familyProfileId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Rank many targets by match. Body: { targets:[...], userId?, familyProfileId? }
router.post("/rank", async (req, res) => {
  const { targets, userId, familyProfileId } = req.body || {};
  if (!Array.isArray(targets)) return res.status(400).json({ error: "targets[] required" });
  try {
    res.json({ ranked: await rankByMatch(targets, { userId, familyProfileId }) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Experience Prediction ("Families like yours rated this X%").
router.post("/predict", async (req, res) => {
  const { target, userId, familyProfileId } = req.body || {};
  if (!target) return res.status(400).json({ error: "target required" });
  try {
    res.json(await predict(target, { userId, familyProfileId }));
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
