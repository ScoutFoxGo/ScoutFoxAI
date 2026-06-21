// routes.js — Scout Companion, mounted at /api/companion.
import { Router } from "express";
import { tripAlerts } from "./engine.js";

const router = Router();

// POST /api/companion/alerts { tripId, weather?, now? }
router.post("/alerts", (req, res) => {
  const { tripId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: "tripId required" });
  try { res.json(tripAlerts(req.body)); } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
