// routes.js — saved/shared plans, mounted at /api/plans.
import { Router } from "express";
import { savePlan, getPlan, recentPlans } from "./store.js";

const router = Router();

// Save a plan for sharing. body { plan, meta? } -> { id, url, ... }
router.post("/", (req, res) => {
  try {
    const { plan, meta } = req.body || {};
    const rec = savePlan(plan, meta || {});
    res.json({ ...rec, url: `/plan.html?id=${rec.id}` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/:id", (req, res) => {
  const rec = getPlan(req.params.id);
  if (!rec) return res.status(404).json({ error: "not found" });
  res.json(rec);
});

router.get("/", (_req, res) => res.json({ plans: recentPlans() }));

export default router;
