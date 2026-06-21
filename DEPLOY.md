# Deploy & Connect — ScoutFoxAI backend

## Architecture

```
  scoutfoxgo.com                      api.scoutfox.ai
  ┌────────────────────┐   HTTPS      ┌────────────────────────────┐
  │ Main website       │  ───────►    │ ScoutFoxAI backend (this   │
  │ (your web devs)    │   /api/...   │ repo): decision engine,    │
  │                    │  ◄───────    │ match, persona, LMS, etc.  │
  └────────────────────┘   JSON       └────────────────────────────┘
```

- **`scoutfoxgo.com`** stays the main site (your web developers own it).
- **This repo** runs as its own service on its own domain — recommended
  **`api.scoutfox.ai`** (a subdomain, so it never collides with the existing
  `scoutfoxai.com` site). `.ai` or `.com` is your choice; the code is
  domain‑agnostic.

## Moving off Base44 (sequencing matters)

Base44 currently hosts the **whole consumer app** (Dashboard, FamilyCompass,
PlaceExplorer, etc.). This repo is the **AI backend ("the brain")**, not that
frontend. So the safe migration order is:

1. Web devs build the new frontend on **`scoutfoxgo.com`** (the replacement UI).
2. This repo runs as the **AI API** (`api.scoutfox.ai`); the new site calls it.
3. Confirm the new site + API cover what the Base44 app did (and that any App
   Store build points at the new site).
4. **Then unlink Base44.** Don't unlink first — that would take the live app/App
   Store build down before the replacement is ready.

## 1a. Host on AWS (your preferred stack)

A `Dockerfile` is included, so it runs on any AWS container service. For your
stated scale (10–50 concurrent, 1–3 QPS, $50–$150/mo to start) **start lean**:

- **AWS App Runner** (recommended to launch) — point it at this repo or an ECR
  image; it builds the Dockerfile, gives HTTPS + autoscaling, ~lowest ops. Set
  env vars from **Secrets Manager** (`ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`,
  `SCOUTFOXGO_DATA_URL`, `LIVE_ONLY=true`, booking keys).
- **Lightsail Containers** — even cheaper/simpler if you want a fixed low price.
- **ECS/EKS + RDS/DynamoDB + CloudFront** (your doc's target) — the scale‑out
  shape; move here when traffic grows past App Runner. The container is the same.

Notes tying to your security spec: keep API keys in **Secrets Manager** (the app
reads them as env vars — never in code), put **CloudFront** in front for TLS 1.2+
and caching, and add your **"anonymize user data before sending to OpenAI"** step
inside the `server/llm.js` `invokeLLM` seam — that's the single choke point every
model call passes through, so it's the right place to scrub PII.

## 1b. Host on Render (fastest to a live URL)

`render.yaml` is ready. Render → **New → Blueprint → this repo/branch**, then in
the dashboard set environment variables (see `server/.env.example`):

- `ALLOWED_ORIGINS=https://scoutfoxgo.com,https://www.scoutfoxgo.com`
- `ANTHROPIC_API_KEY=...` (and `LIVE_ONLY=true` once everything below is set)
- `SCOUTFOXGO_DATA_URL=...` (your live data endpoint)
- booking / other keys as you get them

You'll get `https://<service>.onrender.com`. Test there first.

## 2. Point the domain (IONOS or wherever the DNS lives)

In the DNS for your chosen domain, add a record for the API subdomain pointing
at the host (Render gives you the exact target + a TLS validation record):

- `api.scoutfox.ai`  → CNAME → `<service>.onrender.com`

TLS is automatic once DNS propagates.

## 3. Tell your web developers how to connect

Give them two things:

1. **API base URL:** `https://api.scoutfox.ai`
2. **The endpoints** (all under `/api`). The main ones:
   - `POST /api/decision/plan` — make a trip plan
   - `POST /api/decision/recommend` — Best/Alternative/Budget/Premium + confidence
   - `POST /api/match/score` — Scout Match Score + Decision Confidence band
   - `POST /api/match/predict` — "Families like yours rated this X%"
   - `POST /api/match/behavior` — record likes/dislikes/budget (learning loop)
   - `POST /api/persona/classify` — persona + life stage + tuning
   - `GET /api/destination/:name/intel`, `POST /api/destination/compare`
   - `POST /api/lms/tutor` — Scout Guide (closed RAG answers)
   - `GET /api/admin/analytics` — dashboard data

Their frontend just `fetch`es `https://api.scoutfox.ai/api/...`. As long as their
site origin is in `ALLOWED_ORIGINS`, the browser will allow the calls.

> Secrets stay on **this** backend as env vars — your web devs never need your
> Anthropic/booking keys or any personal login to integrate; they only need the
> public API base URL.
