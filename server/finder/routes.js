// routes.js — Finder engines, mounted at /api/finder.
import { Router } from "express";
import { find, FINDERS, isHeat } from "./engine.js";
import { CATEGORIES } from "./places.js";

const router = Router();

router.get("/categories", (_req, res) =>
  res.json({ categories: CATEGORIES.map((c) => ({ key: c, finder: FINDERS[c] })) })
);

// POST /api/finder/:category
// body { location?, familyProfileId?, userId?, criteria?, weather? }
// On hot weather, any finder also nudges toward cooling-off.
router.post("/:category", async (req, res) => {
  const { location, familyProfileId, userId, criteria, weather } = req.body || {};
  let category = req.params.category;
  let heat_redirect = false;
  if (isHeat(weather) && category !== "cooling_off") { category = "cooling_off"; heat_redirect = true; }
  try {
    const r = await find({ category, location, familyProfileId, userId, criteria });
    res.json(heat_redirect ? { ...r, note: "It's hot — switched to the Cooling Off Finder." } : r);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
