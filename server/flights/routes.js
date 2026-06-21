// routes.js — flight search, mounted at /api/flights.
import { Router } from "express";
import { searchFlights } from "./duffel.js";
import { getOffer, createPaymentIntent, createOrder } from "./booking.js";

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

// --- Booking (TEST MODE) ---

// Confirm an offer's current price/availability before paying.
router.get("/offer/:id", async (req, res) => {
  try {
    res.json(await getOffer(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Leg 1: collect the customer's payment. Returns a Stripe client_secret the
// frontend uses to confirm the card (use Stripe test card 4242 4242 4242 4242).
router.post("/booking/payment-intent", async (req, res) => {
  const { offerId } = req.body || {};
  if (!offerId) return res.status(400).json({ error: "offerId required" });
  try {
    res.json(await createPaymentIntent(offerId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Leg 2: after payment succeeds, create the Duffel order (ticket).
// body { offerId, passengers:[...], paymentIntentId }
router.post("/booking/confirm", async (req, res) => {
  const { offerId, passengers, paymentIntentId } = req.body || {};
  if (!offerId) return res.status(400).json({ error: "offerId required" });
  try {
    res.json(await createOrder({ offerId, passengers, paymentIntentId }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

