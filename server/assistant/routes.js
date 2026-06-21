// routes.js — the Scout planning assistant, mounted at /api/assistant.
import { Router } from "express";
import { handleMessage, recordPlanFeedback } from "./assistant.js";
import { getSession, resetSession } from "./session.js";

const router = Router();

// The main conversational endpoint. body { sessionId?, message, familyProfileId? }
// Returns { sessionId, reply, stage, plan, recommendation, suggestions }.
router.post("/message", async (req, res) => {
  try {
    const { sessionId, message, familyProfileId } = req.body || {};
    res.json(await handleMessage(sessionId, message, { familyProfileId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Inspect a conversation (history + working memory).
router.get("/session/:id", (req, res) => res.json(getSession(req.params.id)));

// Start the conversation over (keeps the same id).
router.post("/session/:id/reset", (req, res) => res.json(resetSession(req.params.id)));

// Teach the brain from an in-chat 👍/👎 on a recommended option.
// body { tags:[], accepted, rating? }
router.post("/session/:id/feedback", (req, res) => {
  try {
    res.json(recordPlanFeedback(req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
