// cart.js — turn a composed plan into a bookable cart and check it out.
//
// "Book it" in chat creates a cart from the plan's items, persisted with a short
// id so /checkout.html?cart=… can drive the payment. Checkout runs the real
// two-leg flight flow (Stripe PaymentIntent -> Duffel order) from flights/booking.js
// — which is MOCK-SAFE: with no keys it returns a simulated confirmation, and it
// refuses live keys unless ALLOW_LIVE_PAYMENTS=true. Stays/activities are reserved
// as line items (their partner adapters are mock until those keys are added).

import { load, save } from "../lms/jsondb.js";
import { createPaymentIntent, createOrder } from "../flights/booking.js";

const FILE = "booking_carts";
const newId = () => "cart_" + Math.random().toString(36).slice(2, 10);

// Build a cart from a composed plan (see decision/engine compose()).
export function createCartFromPlan(plan, meta = {}) {
  if (!plan) throw new Error("plan required");
  const items = [];
  // flight = the day-1 arrival item, if any
  const arrival = (plan.days || []).flatMap((d) => d.items).find((i) => i.slot === "arrival");
  if (arrival) items.push({ kind: "flight", title: arrival.title, partner: arrival.partner || "Duffel", price: arrival.price || 0, offerId: arrival.offerId || arrival.id || null, status: "pending" });
  if (plan.stay) items.push({ kind: "stay", title: plan.stay.title, partner: plan.stay.partner || "Stay partner", price: plan.stay.price || 0, nights: plan.estimate?.nights || 1, status: "pending" });
  for (const it of (plan.days || []).flatMap((d) => d.items).filter((i) => i.kind === "activity"))
    items.push({ kind: "activity", title: it.title, partner: it.partner || "Activity partner", price: it.price || 0, status: "pending" });

  const total = (plan.estimate?.total) ?? items.reduce((s, i) => s + (i.price || 0) * (i.nights || 1), 0);
  const db = load(FILE, {});
  const id = newId();
  const cart = { id, created_at: new Date().toISOString(), destination: plan.destination, items, total, currency: "USD", status: "pending", meta };
  db[id] = cart;
  save(FILE, db);
  return cart;
}

export function getCart(id) {
  return load(FILE, {})[id] || null;
}

function persist(cart) {
  const db = load(FILE, {});
  db[cart.id] = cart;
  save(FILE, db);
  return cart;
}

// Check out: pay for the flight (Stripe) + issue the ticket (Duffel), mock-safe.
// passengers: [{ id?, title, given_name, family_name, born_on, gender, email, phone_number }]
export async function payCart(id, { passengers } = {}) {
  const cart = getCart(id);
  if (!cart) throw new Error("cart not found");
  if (cart.status === "booked") return cart;

  const flight = cart.items.find((i) => i.kind === "flight");
  let confirmation = null;
  if (flight) {
    const offerId = flight.offerId || flight.id || "off_mock";
    const pax = Array.isArray(passengers) && passengers.length ? passengers : [defaultPassenger()];
    const payment = await createPaymentIntent(offerId);
    // In a real frontend the card is confirmed client-side with the client_secret
    // before this step; in mock mode payment is simulated.
    const order = await createOrder({ offerId, passengers: pax, paymentIntentId: payment.payment_intent_id });
    confirmation = { payment, order, simulated: !!(payment.simulated || order.simulated) };
    flight.status = "booked";
  }
  for (const i of cart.items) if (i.kind !== "flight") i.status = "reserved";
  cart.status = "booked";
  cart.booked_at = new Date().toISOString();
  cart.confirmation = confirmation;
  return persist(cart);
}

function defaultPassenger() {
  return { id: "pas_mock_1", title: "mr", given_name: "Test", family_name: "Traveler", born_on: "1990-01-01", gender: "m", email: "test@example.com", phone_number: "+15551234567" };
}
