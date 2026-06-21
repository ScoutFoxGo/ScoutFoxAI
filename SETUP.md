# Setup — get ScoutFoxAI running for real

ScoutFoxAI runs **fully offline on mock data out of the box**, then goes live
integration-by-integration as you add keys. Nothing here is required to start.

## 1. Get the code

```bash
git clone https://github.com/ScoutFoxGo/ScoutFoxAI.git
cd ScoutFoxAI
# already cloned an older/empty copy? just update:
git checkout main && git pull origin main
```

Verify you have the full project:

```bash
git log --oneline -1     # latest commit
ls                       # server/  web/  README.md  API_KEYS.md  SETUP.md ...
```

## 2. Install + run

```bash
cd server
npm install
npm start
```

You should see:

```
ScoutFoxAI server on http://localhost:8787  [dev; mock LLM; data: sample-seed]
  integrations live: none yet (running on mock data — add keys in server/.env)
```

Open the product:
- **`http://localhost:8787/assistant.html`** — the chat trip planner
- `…/demo.html` · `…/checkout.html` · `…/plan.html`

## 3. Add your keys (this is the only file you touch)

One command scaffolds the file (cross-platform; never overwrites existing keys):

```bash
cd server
npm run setup        # creates server/.env from .env.example
```

Open **`server/.env`** and paste your real values after each `=`. Leave any line
blank to keep that integration in safe mock mode. `.env` is **gitignored** — your
keys are never committed.

The app **auto-loads `server/.env`** at startup (no extra step). Restart the server
and you'll see the keys picked up:

```
ScoutFoxAI server on http://localhost:8787  [dev; LIVE Anthropic; data: sample-seed]
  env: loaded 3 var(s) from .../server/.env
  integrations live: language_anthropic:live, flights_stays_duffel:live, payments_stripe:test
```

### What each key unlocks (full list in `API_KEYS.md`)

| Priority | Key | Turns on |
|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | Real language (Scout's voice) + internet research |
| 1 | `SCOUTFOXGO_DATA_URL` | Your live trips/family data (else bundled sample) |
| 2 | `DUFFEL_API_KEY` | Real flight + hotel search and booking |
| 2 | `STRIPE_SECRET_KEY` | Checkout payments (use `sk_test_…` first) |
| 3 | `GOOGLE_PLACES_API_KEY`, `VIATOR_API_KEY`, … | Real places / activities |

## 4. Confirm it's really live

```bash
curl http://localhost:8787/api/status
```

Returns exactly what's live vs mock — e.g.:

```json
{
  "mode": "dev",
  "env_vars_loaded": 3,
  "integrations": { "language_anthropic": "live", "flights_stays_duffel": "live", "payments_stripe": "test", "...": "mock" },
  "live_count": 3,
  "note": "3 integration(s) live; the rest run on mock data until you add their keys."
}
```

## Safety notes

- **Payments:** booking refuses to run with **live** Stripe/Duffel keys unless you
  set `ALLOW_LIVE_PAYMENTS=true`. Use test keys (`sk_test_…`, `duffel_test_…`) until
  you're ready to charge real money.
- **No mock in production:** set `LIVE_ONLY=true` and any feature without its key
  fails loudly instead of serving placeholder data.
- **Hosting:** env vars set by your host (Render / Railway / `docker -e`) override
  `server/.env`, so the same code is correct locally and in production.
- **Never** paste keys into chat, commit them, or share account passwords / 2FA
  codes — invite vendors by their own email with scoped, revocable roles.

## Deploy

It's a single service (Express serves the API **and** the built web UI). See
`DEPLOY.md` + the included `Dockerfile` / `render.yaml`. Set the same env vars in
your host's dashboard.
