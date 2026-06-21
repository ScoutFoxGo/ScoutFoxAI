// routes.js — the learning loop, mounted at /api/learning.
import { Router } from "express";
import { recordOutcome, knowledge } from "./loop.js";
import { learnInsights } from "./distill.js";

const router = Router();

// Record an outcome that teaches the brain.
// body { userId?, tags:[], accepted, rating?, segment?, context? }
router.post("/outcome", (req, res) => {
  try { res.json(recordOutcome(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

// What the brain has learned (statistical).
router.get("/knowledge", (_req, res) => res.json(knowledge()));

// Distill interactions into reusable insights via prompt; store in the corpus.
router.post("/distill", async (_req, res) => {
  try { res.json(await learnInsights()); } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
