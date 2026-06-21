// booking.js — flight BOOKING (Duffel orders + Stripe payment), TEST MODE.
//
// Flow: search -> pick an offer -> collect the customer's payment with Stripe
// (PaymentIntent) -> create the Duffel order (ticket). Two money legs:
//   1. Customer pays YOU  -> Stripe PaymentIntent.
//   2. YOU pay the airline -> Duffel order, paid from your Duffel balance.
//
// SAFETY: this refuses to run with LIVE keys unless ALLOW_LIVE_PAYMENTS=true, so
// you can't accidentally charge a real card while testing. Use Stripe test keys
// (sk_test_...) and a Duffel test token (duffel_test_...). Untested from this
// sandbox (no network) — verify the Duffel/Stripe field shapes against their
// current docs when you wire your keys.

import { requireLive } from "../config.js";

const DUFFEL = "https://api.duffel.com";
const duffelHeaders = () => ({
  Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
  "Duffel-Version": process.env.DUFFEL_VERSION || "v2",
  "Content-Type": "application/json",
  Accept: "application/json",
});

// --- safety: never touch live money unless explicitly allowed ---
export function assertSafeMode() {
  const stripeLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
  const duffelLive = /duffel_live_|duffel_production/.test(process.env.DUFFEL_API_KEY || "");
  if ((stripeLive || duffelLive) && process.env.ALLOW_LIVE_PAYMENTS !== "true") {
    throw new Error(
      "Refusing to run bookings with LIVE keys (would charge real money). Use test keys " +
        "(sk_test_…, duffel_test_…), or set ALLOW_LIVE_PAYMENTS=true to override deliberately."
    );
  }
}

// --- confirm an offer (price/availability) before paying ---
export async function getOffer(offerId) {
  if (!process.env.DUFFEL_API_KEY) {
    requireLive("Duffel (DUFFEL_API_KEY)");
    return { id: offerId, total_amount: "240.00", total_currency: "USD", passengers: [{ id: "pas_mock_1" }], simulated: true };
  }
  const res = await fetch(`${DUFFEL}/air/offers/${offerId}`, { headers: duffelHeaders() });
  if (!res.ok) throw new Error(`Duffel offer ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data;
}

// --- leg 1: collect the customer's payment (Stripe PaymentIntent) ---
export async function createPaymentIntent(offerId) {
  assertSafeMode();
  const offer = await getOffer(offerId);
  const amount = Math.round(Number(offer.total_amount) * 100); // cents
  const currency = (offer.total_currency || "USD").toLowerCase();

  if (!process.env.STRIPE_SECRET_KEY) {
    requireLive("Stripe (STRIPE_SECRET_KEY)");
    return { client_secret: "pi_mock_secret", payment_intent_id: "pi_mock", amount, currency, simulated: true };
  }
  const body = new URLSearchParams({
    amount: String(amount),
    currency,
    "automatic_payment_methods[enabled]": "true",
    "metadata[offer_id]": offerId,
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${j.error?.message || "error"}`);
  return { client_secret: j.client_secret, payment_intent_id: j.id, amount, currency };
}

// --- leg 2: create the Duffel order (ticket) after payment succeeded ---
// passengers: [{ id (from offer), title, given_name, family_name, born_on,
//   gender, email, phone_number }]
export async function createOrder({ offerId, passengers, paymentIntentId }) {
  assertSafeMode();
  if (!Array.isArray(passengers) || !passengers.length) throw new Error("passengers[] required");
  const offer = await getOffer(offerId);

  if (!process.env.DUFFEL_API_KEY) {
    requireLive("Duffel (DUFFEL_API_KEY)");
    return { booking_reference: "MOCKPNR", order_id: "ord_mock", status: "confirmed", paymentIntentId, simulated: true };
  }
  const res = await fetch(`${DUFFEL}/air/orders`, {
    method: "POST",
    headers: duffelHeaders(),
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [offerId],
        passengers,
        payments: [{ type: "balance", amount: offer.total_amount, currency: offer.total_currency }],
        metadata: paymentIntentId ? { stripe_payment_intent: paymentIntentId } : undefined,
      },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Duffel order ${res.status}: ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return { booking_reference: j.data?.booking_reference, order_id: j.data?.id, status: "confirmed" };
}
