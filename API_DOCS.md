# API & Integration Documentation — ScoutFoxAI

Every external service ScoutFoxAI can use, with its env var(s), what it powers, and
the **official documentation** to hand your team. This is copy‑paste ready for a
Google Doc. Key inventory + priority is in `API_KEYS.md`; this file adds the docs
links. Nothing is required — the app runs on mock data until a key is present.

> Verify each key really connects with **`GET /api/selftest`** (pings Anthropic,
> Duffel, Stripe) and **`GET /api/status`** (live‑vs‑mock summary).

## Core (live language + your data)

| Service | Env var(s) | Powers | Official docs | Get a key |
|---|---|---|---|---|
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | All AI: assistant replies, NL parsing, insight distillation, internet research | https://docs.claude.com · https://docs.anthropic.com | https://console.anthropic.com |
| **ScoutFoxGo data** | `SCOUTFOXGO_DATA_URL` | Your live trips / family profiles (else bundled sample seed) | (your own endpoint, master‑file JSON shape) | — internal |

## Travel inventory & booking

| Service | Env var(s) | Powers | Official docs | Get a key |
|---|---|---|---|---|
| **Duffel** | `DUFFEL_API_KEY`, `DUFFEL_VERSION` | Real flight + hotel/stay search and ticket issuance | https://duffel.com/docs · API: https://duffel.com/docs/api | https://app.duffel.com |
| **Stripe** | `STRIPE_SECRET_KEY`, `ALLOW_LIVE_PAYMENTS` | Checkout payments (PaymentIntents). Use `sk_test_…` first | https://docs.stripe.com · PaymentIntents: https://docs.stripe.com/api/payment_intents | https://dashboard.stripe.com/apikeys |
| **Viator** | `VIATOR_API_KEY` | Activities / tours inventory | https://docs.viator.com | https://www.viator.com/partner/home |
| **GetYourGuide** | `GETYOURGUIDE_API_KEY` | Activities / experiences (alternate) | https://code.getyourguide.com | https://partner.getyourguide.com |
| **PHPtravels** | `PHPTRAVELS_API_KEY` (+ your install base URL) | Activities/inventory from **your self‑hosted PHPtravels** install | https://docs.phptravels.com · Download/license: https://docs.phptravels.com/startup/download-product | (self‑hosted — see note below) |
| **Cruise inventory** | `CRUISE_API_KEY` | Cruise search (provider TBD — e.g. Widgety / Traveltek) | provider‑specific | provider‑specific |
| **Kayak** | `KAYAK_API_KEY` | Optional alternate flight/price source | https://www.kayak.com/affiliate | affiliate program |

## Enrichment (places & signals)

| Service | Env var(s) | Powers | Official docs | Get a key |
|---|---|---|---|---|
| **Google Places** | `GOOGLE_PLACES_API_KEY` | Real parks/playgrounds/beaches/restaurants + ratings | https://developers.google.com/maps/documentation/places/web-service/overview | https://console.cloud.google.com |
| **Reddit** | `REDDIT_API_KEY` | Community sentiment signals | https://www.reddit.com/dev/api | https://www.reddit.com/prefs/apps |
| **Social sentiment** | `SOCIAL_SENTIMENT_API_KEY` | Aggregate social sentiment (provider of choice) | provider‑specific | provider‑specific |

## Multi‑model comparison (optional, currently mock stubs in `server/llm.js`)

These power the original multi‑model comparison feature. They're stubbed (mock)
until implemented in `llm.js`; here are their docs if you wire them up:

| Provider | Docs |
|---|---|
| OpenAI (GPT) | https://platform.openai.com/docs |
| Google (Gemini) | https://ai.google.dev/gemini-api/docs |
| xAI (Grok) | https://docs.x.ai |
| Perplexity | https://docs.perplexity.ai |

---

## ⚠️ PHPtravels — important: it's a self‑hosted product, not a cloud API

PHPtravels is a **PHP travel‑booking CMS you download and host yourself** (the
purchase page shows a *Download Product* button + a *License Key* used to activate
the install). That license key is a **secret** — keep it private; it is **not** the
same as an API key, and it must **never** be committed to this repo.

To wire ScoutFoxAI's `phptravels` adapter (`server/booking/adapters.js`) to it:
1. **Install & host** PHPtravels per https://docs.phptravels.com (activate with your
   license key on the server, not in this repo).
2. Note your install's **base URL** (e.g. `https://book.yourdomain.com`) and create
   **API credentials** inside the PHPtravels admin.
3. Put those in `server/.env` — the adapter needs both the base URL and an API key.
   (Today the adapter reads `PHPTRAVELS_API_KEY`; when you have the install details,
   we'll add the base‑URL env var and the real request mapping to its API.)

So: the **license key** activates the software; the **API key + base URL** from the
running install are what ScoutFoxAI calls. Two different things.

---

## Security (applies to every key above)

- Put keys only in **`server/.env`** (gitignored) or your host's secret store —
  never in the repo, never pasted into chat.
- Prefer **test** keys (Stripe `sk_test_…`, Duffel test token) until ready to charge.
- Grant vendor access by inviting their **own email** with scoped, revocable roles —
  never share account passwords or forward 2FA codes.
- Rotate any secret that has appeared in a shared doc or screenshot.
