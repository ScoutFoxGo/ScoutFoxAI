// routes.js — saved/shared plans, mounted at /api/plans.
import { Router } from "express";
import { savePlan, getPlan, recentPlans } from "./store.js";
import { planToICS } from "../calendar/ics.js";

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

// Calendar export — add the whole trip to any calendar (Google/Apple/Outlook).
// GET /api/plans/:id/calendar.ics?start=YYYY-MM-DD
router.get("/:id/calendar.ics", (req, res) => {
  const rec = getPlan(req.params.id);
  if (!rec) return res.status(404).json({ error: "not found" });
  try {
    const ics = planToICS(rec.plan, { startDate: req.query.start });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="scout-${req.params.id}.ics"`);
    res.send(ics);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
