// routes.js — the live project tracker, mounted at /api/tracker.
import { Router } from "express";
import { getBoard, summary, addItem, updateItem, deleteItem, addPhase, resetBoard, STATUSES } from "./store.js";

const router = Router();

// The whole board (phases + items + summary).
router.get("/", (_req, res) => res.json({ ...getBoard(), summary: summary(), statuses: STATUSES }));

router.post("/items", (req, res) => {
  try { res.json(addItem(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.patch("/items/:id", (req, res) => {
  try { res.json(updateItem(req.params.id, req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete("/items/:id", (req, res) => {
  try { res.json(deleteItem(req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/phases", (req, res) => {
  try { res.json({ phases: addPhase((req.body || {}).name) }); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/reset", (_req, res) => res.json(resetBoard()));

export default router;
