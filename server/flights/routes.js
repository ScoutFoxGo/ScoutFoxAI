// routes.js — flight search, mounted at /api/flights.
import { Router } from "express";
import { searchFlights } from "./duffel.js";

const router = Router();

// POST /api/flights/search
// body { origin, destination, departure_date, return_date?, adults?, cabin? }
// origin/destination are IATA codes (e.g. "JFK", "LAX"); dates are YYYY-MM-DD.
router.post("/search", async (req, res) => {
  try {
    res.json(await searchFlights(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
