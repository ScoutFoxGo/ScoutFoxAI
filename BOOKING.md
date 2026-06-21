# Flight Booking (test mode)

Search is live via Duffel; this adds **booking** — collecting the customer's
payment (Stripe) and issuing the ticket (Duffel order). Built **test‑mode first**
so nothing real is charged while you verify it.

## Safety first
- Use **test keys**: Stripe `sk_test_…`, Duffel `duffel_test_…`.
- Booking **refuses to run with live keys** unless `ALLOW_LIVE_PAYMENTS=true`.
  Leave that unset until you've tested the whole flow and are ready to go live.
- The two money legs: **Stripe** = customer pays you; **Duffel order** = you pay
  the airline from your Duffel balance (top up your test balance in the Duffel
  dashboard).

## The flow (4 steps)

```
1. POST /api/flights/search          -> pick an offer (offer.id)
2. GET  /api/flights/offer/:id        -> confirm price/availability
3. POST /api/flights/booking/payment-intent  { offerId }
       -> { client_secret }  (frontend confirms the card with Stripe.js,
          test card 4242 4242 4242 4242, any future date/CVC)
4. POST /api/flights/booking/confirm  { offerId, passengers, paymentIntentId }
       -> { booking_reference, order_id, status }   ← the ticket
```

`passengers` (one per traveler, ids from the offer):
```json
{ "id": "pas_…", "title": "ms", "gender": "f",
  "given_name": "Meghan", "family_name": "Hotchkiss",
  "born_on": "1990-01-01", "email": "m@example.com",
  "phone_number": "+15551234567" }
```

## Try it
1. Set in the server env: `DUFFEL_API_KEY=duffel_test_…`, `STRIPE_SECRET_KEY=sk_test_…`.
2. Run the 4 calls above (the frontend handles step 3's card entry with Stripe.js).
3. You get a real **test** booking reference from Duffel — no real money moved.

## Going live (later, deliberately)
Swap to live keys, set `ALLOW_LIVE_PAYMENTS=true`, and only after you've:
- confirmed the Duffel `Duffel-Version` + order/payment fields against current docs,
- tested refunds/cancellations and error paths,
- handled Stripe webhooks for payment confirmation,
- reviewed airline ticketing/refund terms and your refund policy.

> I couldn't test the live Duffel/Stripe calls from the build environment (no
> outbound network). The request shapes follow Duffel's Orders and Stripe's
> PaymentIntents docs; verify against the current docs when you add your keys —
> errors come back with the exact field to fix.
