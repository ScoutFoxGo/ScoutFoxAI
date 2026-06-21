// routes.js — Scout Harmony, mounted at /api/harmony.
import { Router } from "express";
import { harmonize } from "./engine.js";

const router = Router();

// POST /api/harmony/decide
// body { participants:[{name, prefs?:[], familyProfileId?}], destination?, candidates?:[{title,tags,price}] }
router.post("/decide", (req, res) => {
  try {
    res.json(harmonize(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
