// routes.js — Scout Modes, mounted at /api/modes.
import { Router } from "express";
import { MODES, recommendForMode } from "./engine.js";

const router = Router();

router.get("/", (_req, res) =>
  res.json({ modes: Object.entries(MODES).map(([key, m]) => ({ key, label: m.label, optimize: m.optimize })) })
);

// POST /api/modes/:mode/route  body { destination?, familyProfileId? }
router.post("/:mode/route", (req, res) => {
  try {
    res.json(recommendForMode(req.params.mode, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
