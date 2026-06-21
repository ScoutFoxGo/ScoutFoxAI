# ScoutFoxAI — Developer Handoff / Integration Brief

ScoutFoxAI is a **closed, self‑contained AI backend** — the "decision
intelligence" brain. It runs on its own (`api.scoutfox.ai`) and the main app
(`scoutfoxgo.com`) integrates by calling its HTTP API. No Base44, no secrets on
the client.

## Base URL & connection
- **Base URL:** `https://api.scoutfox.ai` (all routes under `/api`)
- **CORS:** the backend sets `ALLOWED_ORIGINS` to your site(s); browser calls
  from those origins are allowed.
- **Auth (optional):** if `SCOUTFOX_API_KEY` is set, send it as
  `X-API-Key: <key>` (use this for server‑to‑server; never expose the key in
  browser code — call from your backend, or rely on CORS for browser calls).
- **Health check:** `GET /api/health` → `{ ok, anthropic }` (no auth).

## Core endpoints (everything returns JSON)

**Decision Layer — make/refine a plan**
- `POST /api/decision/plan` — body `{ request, familyProfileId?, destination?, days?, budget?, pace?, weather? }` → a day‑structured plan with cost estimate + confidence.
- `POST /api/decision/recommend` — same body → Best Match / Alternative / Budget / Premium / Indoor + Outdoor backups, each explained, with a confidence band.
- `POST /api/decision/refine` — `{ intent, feedback }` (intent comes back on every plan) → reshaped plan.

**Match & Confidence**
- `POST /api/match/score` — `{ target:{title,tags[],price?}, userId?, familyProfileId? }` → `{ match_score, band, confidence, reasons }`.
- `POST /api/match/predict` — same → `"Families like yours rated this X%"`.
- `POST /api/match/behavior` — `{ userId, signal:{type:"like|dislike|budget|accept|reject", value?, tags?} }` → learns the user (improves scores over time).
- `GET /api/match/behavior/:userId` → the learned profile.

**Persona & Destination Intelligence**
- `POST /api/persona/classify` — `{ familyProfileId }` or `{ kids_info, who_is_going }` → persona + life stage + recommendation tuning.
- `GET /api/destination/:name/intel?familyProfileId=...` → sentiment, family‑fit, best‑for, pain points, season.
- `POST /api/destination/compare` — `{ a, b, familyProfileId? }` → picks one for the family + why.

**Scout Guide (closed RAG)**
- `POST /api/lms/tutor` — `{ question, userId?, allowResearch? }` → answer grounded only in the owned corpus (research is opt‑in).

**Admin (for an internal dashboard)**
- `GET /api/admin/analytics`, `/api/admin/sessions`, `/api/admin/traces`, `GET|POST /api/admin/feedback`.

## Example call
```js
const res = await fetch("https://api.scoutfox.ai/api/decision/recommend", {
  method: "POST",
  headers: { "Content-Type": "application/json" /*, "X-API-Key": KEY */ },
  body: JSON.stringify({ request: "a relaxed weekend somewhere warm", familyProfileId: "FP001", weather: "sunny" }),
});
const recommendation = await res.json(); // { best_match, alternative, budget_option, ... confidence }
```

## Data
ScoutFoxAI reads families/trips from **your** data via `SCOUTFOXGO_DATA_URL`
(same JSON shape as the master file). The dev team owns the user/trip data; this
backend reads it and returns intelligence. Nothing here needs the team to hand
over any personal account or key — only the API base URL (and optional API key).

## What stays closed
Retrieval, scoring, personas, and the learning loop are all in‑house. The only
outward calls are: the LLM provider (server‑side key), optional booking partners,
and optional community‑signal sources — each guarded and off unless configured.
