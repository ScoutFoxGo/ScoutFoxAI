// admin.routes.js — Administrative AI Tools endpoints, mounted at /api/admin.
// Consumed by the Next.js admin dashboard.
import { Router } from "express";
import { analytics, sessions, listTraces, recordFeedback, listFeedback } from "./admin.js";

const router = Router();

router.get("/analytics", (_req, res) => res.json(analytics()));
router.get("/sessions", (_req, res) => res.json({ sessions: sessions() }));
router.get("/traces", (req, res) => res.json({ traces: listTraces(Number(req.query.limit) || 100) }));
router.get("/feedback", (_req, res) => res.json({ feedback: listFeedback() }));
router.post("/feedback", (req, res) => {
  try {
    res.json(recordFeedback(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
