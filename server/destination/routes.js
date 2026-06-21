// routes.js — Destination Intelligence, mounted at /api/destination.
import { Router } from "express";
import { intel, compare } from "./intel.js";

const router = Router();

// Intel on one destination (optionally tuned to a family).
// GET /api/destination/:name/intel?familyProfileId=FP001&userId=u1
router.get("/:name/intel", async (req, res) => {
  try {
    res.json(await intel(req.params.name, { familyProfileId: req.query.familyProfileId, userId: req.query.userId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Head-to-head comparison for a family. Body: { a, b, familyProfileId?, userId? }
router.post("/compare", async (req, res) => {
  const { a, b, familyProfileId, userId } = req.body || {};
  if (!a || !b) return res.status(400).json({ error: "a and b (destination names) required" });
  try {
    res.json(await compare(a, b, { familyProfileId, userId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
