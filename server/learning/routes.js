// routes.js — the learning loop, mounted at /api/learning.
import { Router } from "express";
import { recordOutcome, knowledge, priorBreakdown, segmentSeed, forget, reset, anomalies } from "./loop.js";
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
  res.json({ instant: knowledge(), durable: getLatestInsights(5), anomalies: anomalies().flagged });
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

// WHY a tag scores the way it does — global vs specialized prior + the drivers.
// GET /explain?tag=indoor&segment=toddler-family&context=rainy
router.get("/explain", (req, res) => {
  const { tag, segment, context } = req.query;
  if (!tag) return res.status(400).json({ error: "tag query param required" });
  res.json(priorBreakdown(tag, segment, context));
});

// COLD-START: what a segment's taste looks like, used to seed brand-new families.
// GET /seed?segment=toddler-family
router.get("/seed", (req, res) => res.json(segmentSeed(req.query.segment)));

// Guard rail: tags whose recent feedback swings hard from their long-run rate.
router.get("/anomalies", (req, res) => {
  const window = req.query.window ? Number(req.query.window) : undefined;
  const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
  res.json(anomalies({ window, threshold }));
});

// FORGET a slice of learning (e.g. a bad streak). body { tag?, segment?, context?, before?, userId? }
router.post("/forget", (req, res) => {
  try { res.json(forget(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

// RESET all learned interactions (distilled corpus insights are kept).
router.post("/reset", (_req, res) => res.json(reset()));

export default router;
