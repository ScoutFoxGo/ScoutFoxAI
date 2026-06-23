// routes.js — Scout Companion, mounted at /api/companion.
import { Router } from "express";
import { tripAlerts } from "./engine.js";
import { sendSMS } from "./sms.js";

const router = Router();
const sev = (s) => ({ high: 3, medium: 2, low: 1 }[s] || 0);

// POST /api/companion/alerts { tripId, weather?, now? }
router.post("/alerts", (req, res) => {
  const { tripId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: "tripId required" });
  try { res.json(tripAlerts(req.body)); } catch (e) { res.status(400).json({ error: e.message }); }
});

// Proactive: text the top alerts to a family. body { tripId, to, weather? }
// Live with Twilio keys; labelled simulated otherwise.
router.post("/notify", async (req, res) => {
  const { tripId, to } = req.body || {};
  if (!tripId || !to) return res.status(400).json({ error: "tripId and to required" });
  try {
    const a = tripAlerts(req.body);
    const top = a.alerts.slice().sort((x, y) => sev(y.severity) - sev(x.severity)).slice(0, 3);
    const body = `🦊 Scout — ${a.trip}\n` + top.map((al) => `• ${al.message}`).join("\n");
    const sms = await sendSMS(to, body.slice(0, 1000));
    res.json({ ...sms, alerts_sent: top.length, trip: a.trip });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
