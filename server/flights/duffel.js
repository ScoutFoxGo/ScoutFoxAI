// duffel.js — real flight SEARCH via Duffel (the air-content API).
//
// Live when DUFFEL_API_KEY is set; clearly-labelled mock otherwise so the demo
// runs. Under LIVE_ONLY a missing key fails loudly instead of faking flights.
//
// NOTE: this is search only (offers). Actual booking = Duffel "orders" + payment
// (Stripe), which is a separate, money-handling build. Verify the exact
// Duffel-Version + field names against current Duffel docs when you add your key
// (set DUFFEL_VERSION to match); the request below follows their Offer Requests
// shape but can't be tested from this sandbox (no outbound network).

import { requireLive } from "../config.js";

const norm = (o) => ({
  id: o.id,
  airline: o.owner?.name || o.owner?.iata_code || "—",
  price: Number(o.total_amount),
  currency: o.total_currency,
  cabin: o.cabin_class || null,
  slices: (o.slices || []).map((s) => ({
    from: s.origin?.iata_code,
    to: s.destination?.iata_code,
    depart: s.segments?.[0]?.departing_at || null,
    stops: Math.max(0, (s.segments?.length || 1) - 1),
    duration: s.duration || null,
  })),
});

function mockOffers({ origin, destination, departure_date, adults }) {
  return [
    { label: "Nonstop", base: 240, stops: 0 },
    { label: "1 stop (value)", base: 180, stops: 1 },
    { label: "Premium nonstop", base: 420, stops: 0 },
  ].map((o, i) => ({
    id: `mock_${i}`,
    airline: o.label,
    price: o.base * (adults || 1),
    currency: "USD",
    cabin: i === 2 ? "business" : "economy",
    simulated: true,
    slices: [{ from: origin, to: destination, depart: `${departure_date}T08:00:00`, stops: o.stops, duration: `PT${2 + o.stops}H` }],
  }));
}

export async function searchFlights({ origin, destination, departure_date, return_date, adults = 1, cabin = "economy" }) {
  if (!origin || !destination || !departure_date) {
    throw new Error("origin, destination, and departure_date are required (IATA codes, e.g. JFK/LAX)");
  }

  if (!process.env.DUFFEL_API_KEY) {
    requireLive("Duffel flights (DUFFEL_API_KEY)"); // throws under LIVE_ONLY
    return { source: "mock", offers: mockOffers({ origin, destination, departure_date, adults }) };
  }

  const slices = [{ origin, destination, departure_date }];
  if (return_date) slices.push({ origin: destination, destination: origin, departure_date: return_date });

  const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
      "Duffel-Version": process.env.DUFFEL_VERSION || "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: { slices, passengers: Array.from({ length: adults }, () => ({ type: "adult" })), cabin_class: cabin },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Duffel ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  const offers = (json?.data?.offers || []).slice(0, 20).map(norm);
  return { source: "duffel", offers };
}
