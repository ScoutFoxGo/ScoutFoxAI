// routes.js — ScoutFoxGo AI module endpoints, mounted at /api/scout.
// These operate on real ScoutFoxGo entities (from data.js) and are the AI side
// of the Missing Modules addendum: Mood AI, Scout Scribe, Smart Cards.
import { Router } from "express";
import { listTrips, getTrip, getTripDays, listFamilyProfiles } from "./data.js";
import { adaptItinerary } from "../modules/mood.js";
import { tripReport } from "../modules/scribe.js";
import { generateCards } from "../modules/smartcards.js";

const router = Router();

// --- entities (handy for wiring a UI / verifying the bridge) ---
router.get("/trips", (_req, res) => res.json({ trips: listTrips() }));
router.get("/trips/:id", (req, res) => {
  const trip = getTrip(req.params.id);
  if (!trip) return res.status(404).json({ error: "not found" });
  res.json({ ...trip, days: getTripDays(trip.id) });
});
router.get("/family", (_req, res) => res.json({ family_profiles: listFamilyProfiles() }));

// --- Mood AI (2.6) ---
router.post("/mood/adapt", async (req, res) => {
  const { tripId, mood, familyProfileId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: "tripId required" });
  try {
    res.json(await adaptItinerary({ tripId, mood, familyProfileId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Scout Scribe (2.8) ---
router.post("/scribe/report", async (req, res) => {
  const { tripId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: "tripId required" });
  try {
    res.json(await tripReport({ tripId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Smart Cards (2.15) ---
router.post("/cards/generate", async (req, res) => {
  const { tripId, weather, mood } = req.body || {};
  if (!tripId) return res.status(400).json({ error: "tripId required" });
  try {
    res.json(await generateCards({ tripId, weather, mood }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
