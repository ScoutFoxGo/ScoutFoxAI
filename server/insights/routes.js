// routes.js — growth insights, mounted at /api/insights.
import { Router } from "express";
import { recordFeedback, listFeedback, feedbackStats } from "./feedback.js";
import { weeklyReview } from "./digest.js";

const router = Router();

// Capture user feedback. body { userId?, rating(1-5)?, nps(0-10)?, comment?, area?, sessionId? }
router.post("/feedback", (req, res) => {
  try { res.json(recordFeedback(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/feedback", (req, res) => res.json({ feedback: listFeedback(Number(req.query.limit) || 50) }));

// Behavior + feedback metrics for a window (default 7 days).
router.get("/metrics", (req, res) => res.json(feedbackStats({ windowDays: Number(req.query.days) || 7 })));

// The weekly review: measure behavior + talk to users + suggested improvements.
// ?days=7&narrate=1
router.get("/weekly", async (req, res) => {
  try {
    res.json(await weeklyReview({ windowDays: Number(req.query.days) || 7, narrate: /^(1|true|yes)$/i.test(req.query.narrate || "") }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
