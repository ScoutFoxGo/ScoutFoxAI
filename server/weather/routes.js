// routes.js — live weather, mounted at /api/weather.
import { Router } from "express";
import { getWeather } from "./openweather.js";

const router = Router();

// GET /api/weather/:place -> { place, token, temp_c, description } or a mock note.
router.get("/:place", async (req, res) => {
  try {
    const w = await getWeather(req.params.place);
    if (w) return res.json(w);
    res.json({ place: req.params.place, token: null, simulated: true, note: "OPENWEATHER_API_KEY not set (or place not found) — weather is mock/unknown." });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
