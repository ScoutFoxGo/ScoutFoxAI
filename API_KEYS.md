# ScoutFoxAI — Running List of APIs / Keys You Need

This is the master checklist of every external service the Scout brain can use.
**Nothing here is required to run** — the app boots fully offline with mock data
and a mock LLM. Add a key only when you want that piece to go **live**. In
`LIVE_ONLY=true` mode, any feature you actually call must have its key set or the
request fails loudly (never with fake data).

Set keys as environment variables (see `server/.env.example`). Legend:
**Tier 1** = needed for a real demo · **Tier 2** = travel inventory/booking ·
**Tier 3** = enrichment (nice-to-have).

---

## Tier 1 — Core brain (get these first)

| # | Service | Env var | What it powers | Where to get it | Status |
|---|---------|---------|----------------|-----------------|--------|
| 1 | **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | All AI: recommendations, NL parsing, tutor, insight distillation, **internet research** (web search). Without it everything runs in labelled mock mode. | console.anthropic.com | ☐ |
| 2 | **ScoutFoxGo data** | `SCOUTFOXGO_DATA_URL` | Live trips / family profiles / scrapbook (your own endpoint returning the master-file JSON). Falls back to the bundled sample seed in dev. | Your own backend | ☐ |

> Anthropic is the only key needed to make the whole brain "real," including
> pulling knowledge from the internet. Start here.

## Tier 2 — Travel inventory & booking

| # | Service | Env var | What it powers | Where to get it | Status |
|---|---------|---------|----------------|-----------------|--------|
| 3 | **Duffel** | `DUFFEL_API_KEY` (+ `DUFFEL_VERSION`, default `v2`) | Real flight search **and** hotel/stay inventory + ticket issuance. The primary booking partner. | duffel.com | ☐ |
| 4 | **Stripe** | `STRIPE_SECRET_KEY` (+ `ALLOW_LIVE_PAYMENTS`) | Collects customer payment for flight booking. **Use a TEST key** — bookings refuse to run with a live key unless `ALLOW_LIVE_PAYMENTS=true`. | dashboard.stripe.com | ☐ |
| 5 | **Viator** | `VIATOR_API_KEY` | Activities / tours inventory. | partnerresources.viator.com | ☐ |
| 6 | **GetYourGuide** | `GETYOURGUIDE_API_KEY` | Activities / experiences inventory (alternate). | partner.getyourguide.com | ☐ |
| 7 | **Cruise inventory** | `CRUISE_API_KEY` | Cruise search in the unified inventory. (Provider TBD — Widgety / your aggregator.) | provider-specific | ☐ |
| 8 | **Kayak** | `KAYAK_API_KEY` | Optional alternate flight/price source. | kayak.com/affiliate | ☐ |
| 9 | **PHPTravels** | `PHPTRAVELS_API_KEY` | Optional alternate travel inventory adapter. | phptravels.com | ☐ |

## Tier 3 — Enrichment (signals & places)

| # | Service | Env var | What it powers | Where to get it | Status |
|---|---------|---------|----------------|-----------------|--------|
| 10 | **Google Places** | `GOOGLE_PLACES_API_KEY` | Real parks/playgrounds/beaches/restaurants in the Finder engines + place ratings for community sentiment. | console.cloud.google.com | ☐ |
| 11 | **Reddit** | `REDDIT_API_KEY` | Community signals (real-family sentiment) feeding the Match Score. | reddit.com/dev/api | ☐ |
| 12 | **Social sentiment** | `SOCIAL_SENTIMENT_API_KEY` | Aggregate social sentiment signal (provider of your choice). | provider-specific | ☐ |

---

## Not an API key — but also set in production

| Setting | Env var | Purpose |
|---------|---------|---------|
| Allowed origins | `ALLOWED_ORIGINS` | Comma-separated sites allowed to call this API cross-domain (e.g. your main website). |
| API auth | `SCOUTFOX_API_KEY` | Optional shared secret; if set, every `/api` call (except `/health`) needs `X-API-Key`. |
| Live mode | `LIVE_ONLY` | Refuse all mock/placeholder content — every feature you call must be wired. |
| Port | `PORT` | Server port (default 8787). |

---

## Security reminders (carried from ACCESS.md / ROTATION.md)

- **Never** share Gmail/Google account passwords or forward 2FA/verification codes
  to a vendor or dev. Grant access by inviting the vendor's **own email** with a
  scoped, revocable role.
- Keep keys in environment variables / a secrets manager — **never** commit them
  to the repo or paste them into chat. Rotate any key that lands in a shared doc.
- Prefer **test** keys (Stripe especially) until you're ready to charge real money.

_Last updated: 2026-06-21. Source of truth for env vars: `server/.env.example`._
