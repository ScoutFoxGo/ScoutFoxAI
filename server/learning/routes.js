// routes.js — the learning loop, mounted at /api/learning.
import { Router } from "express";
import { recordOutcome, knowledge } from "./loop.js";
import { learnInsights, getLatestInsights, researchKnowledge } from "./distill.js";

const router = Router();

// Record an outcome that teaches the brain.
// body { userId?, tags:[], accepted, rating?, segment?, context? }
router.post("/outcome", (req, res) => {
  try { res.json(recordOutcome(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

// What the brain has learned (statistical).
router.get("/knowledge", (_req, res) => res.json(knowledge()));

// Full learned state: instant (statistical tag priors) + durable (distilled
// insights). One call the UI/team can poll to see the loop working.
router.get("/state", (_req, res) => {
  res.json({ instant: knowledge(), durable: getLatestInsights(5) });
});

// Distill interactions into reusable insights via prompt; store in the corpus.
router.post("/distill", async (_req, res) => {
  try { res.json(await learnInsights()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pull knowledge from the internet on a topic (Claude web search) and distill it
// into the closed corpus. Opt-in. body { topic }
router.post("/research", async (req, res) => {
  try {
    const { topic } = req.body || {};
    res.json(await researchKnowledge(topic));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
