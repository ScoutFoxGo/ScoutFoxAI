// routes.js — Persona & Segmentation, mounted at /api/persona.
import { Router } from "express";
import { classify } from "./classify.js";

const router = Router();

// Classify a family/user into a persona + life stage + recommendation tuning.
// Body: { familyProfileId? } or { kids_info?, preferences?, who_is_going?, adults?, userId? }
router.post("/classify", (req, res) => {
  try {
    res.json(classify(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
