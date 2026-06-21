// routes.js — Scout CrowdSense, mounted at /api/crowdsense.
import { Router } from "express";
import { predictCrowd, bestDay } from "./engine.js";

const router = Router();

// POST /api/crowdsense/predict { place, tags?, date? }
router.post("/predict", (req, res) => {
  try { res.json(predictCrowd(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/crowdsense/best-day { place, tags?, from?, days? }
router.post("/best-day", (req, res) => {
  try { res.json(bestDay(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
