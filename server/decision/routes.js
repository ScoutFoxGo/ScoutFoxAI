// routes.js — Decision Layer endpoints, mounted at /api/decision.
import { Router } from "express";
import { planTrip, refinePlan, understand, recommendTrip } from "./engine.js";

const router = Router();

// Recommendation Model: Best Match / Alternative / Budget / Premium / Indoor +
// Outdoor backups, each explained, with a confidence score.
// Body: { request, familyProfileId?, destination?, budget?, pace?, weather? }
router.post("/recommend", async (req, res) => {
  try {
    res.json(await recommendTrip(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Make a plan from a natural-language request (+ optional family profile / fields).
// Body: { request, familyProfileId?, destination?, days?, budget?, pace? }
router.post("/plan", async (req, res) => {
  try {
    res.json(await planTrip(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Conversational refine. Body: { intent, feedback } (intent comes back on every plan).
router.post("/refine", (req, res) => {
  const { intent, feedback } = req.body || {};
  if (!intent || !feedback) return res.status(400).json({ error: "intent and feedback required" });
  try {
    res.json(refinePlan({ intent, feedback }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Inspect just the parsed intent (the Understand stage) — handy for debugging.
router.post("/understand", async (req, res) => {
  try {
    res.json(await understand(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
