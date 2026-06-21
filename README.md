# ScoutFoxAI

**AI behind ScoutFoxGo** — a multi-model AI comparison engine. Ask one question,
get answers from every leading model in parallel, then a **synthesis** that
reconciles them and an **AI judge** that scores them and names a winner.

This is a self-contained, you-own-it implementation of the ScoutFoxAI app
(originally built on Base44). It replaces Base44's hosted `InvokeLLM` and
entity store with a small open-source backend you control, so the whole thing
runs locally — and on real Claude responses the moment you add an API key.

## What's here

```
server/   Node + Express API. The LLM proxy (replaces base44 InvokeLLM) +
          a JSON store for saved/shared comparisons.
web/      React + Vite + Tailwind frontend. The comparison engine:
          parallel model calls → synthesis → AI judge, with expandable
          response cards, Fast/Pro tier toggle, stacked/side-by-side views,
          a prompt-template library, and per-comparison share links.
```

## How it works

The comparison **orchestration lives in the frontend** (`web/src/pages/Home.jsx`,
the `ask()` function) — exactly like the original Base44 `Home.jsx`:

1. **Fan out** to every model in the selected tier in parallel
   (`Promise.allSettled`, so one failure doesn't sink the rest). Cards stream
   in as each model returns.
2. **Synthesize** — a Claude pass reads all answers and reports agreement,
   differences, and a final take.
3. **Persist** the comparison (gives every card a share link).
4. **Judge** — a second Claude pass scores each model and names a winner.

Each step calls `POST /api/invoke` on the backend, which routes to the right
provider in `server/llm.js`. That file is the one place to wire real providers.

## Models

| Tier | Models |
|------|--------|
| **Fast** (default) | Claude Sonnet 4.6, GPT-5 Mini, Gemini 3 Flash, Grok, Perplexity |
| **Pro / Advanced** | Claude Opus 4.8, GPT-5.5, Gemini 3.1 Pro, Grok, Perplexity |

Claude models call the **real Anthropic API** when `ANTHROPIC_API_KEY` is set.
The other providers ship with a clearly-labelled offline **mock** so the app is
fully usable with zero credentials — add a real adapter in `server/llm.js`
(`callOpenAI`, etc.) when you want them live.

## Run it

Two terminals:

```bash
# 1) Backend  (http://localhost:8787)
cd server
npm install
# optional, for real Claude answers:
#   cp .env.example .env  &&  edit ANTHROPIC_API_KEY
#   export ANTHROPIC_API_KEY=sk-ant-...
npm start

# 2) Frontend  (http://localhost:5173)
cd web
npm install
npm run dev
```

Open http://localhost:5173, type a question, hit **Compare**.

Without an API key you'll see `● mock mode` in the header and simulated answers;
with one set you'll see `● live Claude` and real Claude responses for the Claude
models.

## The Decision Layer — core recommendation engine (`server/decision/`, `server/booking/`)

The heart of the product: a natural-language request + a family profile in, **one
bookable, day-structured, explainable plan** out (not a list). Pipeline:

1. **Understand** — NL → structured intent (destination, days, budget, pace,
   family prefs). AI parses fuzzy language; a deterministic parse runs with no key.
2. **Gather** — `server/booking/` pulls options through one internal interface
   with mock **Duffel** (flights) / **Kayak** (stays) / **PHPtravels** (activities)
   adapters (drop in real keys later; the engine doesn't change).
3. **Reason** — scores every option against the family's real constraints
   (budget, preferences, accessibility, pace, must-haves/hard-nos).
4. **Compose** — assembles a day-by-day plan paced by energy, each item with a
   visible reason, plus a cost estimate and Scout Points estimate.
5. **Refine** — conversational edits ("cheaper", "slower", "more accessible")
   reshape the plan.

Endpoints: `POST /api/decision/plan {request, familyProfileId?, destination?,
days?, budget?, pace?, weather?}`, `POST /api/decision/refine {intent, feedback}`,
`POST /api/decision/recommend` (Recommendation Model below), `POST
/api/decision/understand`. Reasoning/compose are deterministic (explainable,
offline); only Understand optionally calls the model.

**Scout persona + Recommendation Model.** The Scout Fox Go™ Master System Prompt
lives in `server/scout/persona.js` and is the single source of truth: AI calls
pass it as the system prompt, and the engine encodes the spec's structured logic
— the **Scout Ranking Algorithm** weights (preference 30 / convenience 20 /
budget 15 / accessibility 15 / quality 10 / weather 5 / novelty 5), **confidence
scores** (High/Medium/Low), and the **Recommendation Model**: `POST
/api/decision/recommend` returns a Best Match + Alternative + Budget + Premium +
Indoor/Outdoor backups, each with why-it-fits, estimated cost (flagged "verify"),
ideal duration, who it's best for, drawbacks, and prep — and re-ranks on weather.

## Live data vs dev (no placeholders in production)

By default the app runs **offline** for development: a mock LLM, sample
ScoutFoxGo data, and mock booking inventory. To run on **real data**, set
credentials and turn on `LIVE_ONLY` — which makes the system **refuse to serve
any placeholder** (mock LLM answers, sample data, and mock inventory all throw
instead of returning fake results, so nothing example-like can ship).

| Env var | Enables live… |
|---|---|
| `ANTHROPIC_API_KEY` | Claude responses (LLM, synthesis, judge, tutor, research, NL parsing) |
| `SCOUTFOXGO_DATA_URL` | real trips / families / scrapbook from your ScoutFoxGo endpoint (master-file JSON shape) |
| `DUFFEL_API_KEY` / `KAYAK_API_KEY` / `PHPTRAVELS_API_KEY` | live booking inventory in the Decision Layer |
| `LIVE_ONLY=true` | hard guard — fail loudly if any of the above is missing rather than serve placeholders |

Note: the booking adapters have the real-call site stubbed (`TODO`) pending your
partner credentials — they pull live once you implement the marked call with your
key. Everything else uses live data the moment its credential is set.

## How Scout self-learns (`server/learning/`)

Scout gains knowledge two complementary ways, and both feed back into the brain:

1. **From interactions (statistical, every use).** `POST /api/learning/outcome
   {tags, accepted, rating?, userId?, segment?, context?}` records whether a
   recommendation was taken. Priors are **derived from the event log** so one model
   captures four things at once:
   - **recency** — recent outcomes count more (45‑day half‑life), so Scout adapts
     to changing tastes/seasons instead of being anchored by old data;
   - **rating** — a 1–5 `rating` is a finer signal than binary accept/reject;
   - **segment** — learns differently for toddler‑families vs. grandparents vs. teens;
   - **context** — learns by weather/season (e.g. "indoor wins when it's wet").

   The **Match Score folds that prior in (15%)**, specialized to the family's
   segment *and* the current context when known and blended over the global signal
   by how much specific evidence exists — so recommendations shift toward what works
   *for this kind of family, under these conditions*. `GET /api/learning/knowledge`
   shows what it's learned (with `by_segment` and `by_context` breakdowns).
   *(Demonstrated: the same `indoor` tag learned to 0.92 when it's wet and 0.08 when
   clear while staying 0.50 globally; recent rejects overrode equal‑count old accepts
   (0.12); rated‑5 beat rated‑2 (0.90 vs 0.30) though both were "accepted.")*

2. **From prompts (distillation, durable).** `POST /api/learning/distill` takes the
   raw acceptance aggregates and asks the model to write 2–3 concise, reusable
   planning insights, then stores them in the **closed corpus** (so the Scout
   Guide tutor and the team can use them). This is the "gaining knowledge with
   prompts" half; it runs deterministically offline and is LLM‑written with a key.
   It also runs **automatically** every 10 interactions, so the durable layer keeps
   itself current with no manual step.

3. **From the internet (research, opt‑in).** `POST /api/learning/research {topic}`
   pulls fresh knowledge from the web via Claude web search and **distills it into
   the same closed corpus** as durable knowledge — Scout learns from the open web
   but stores only its own in‑house lessons. Off by default; live with an Anthropic
   key + network, clearly labelled simulated otherwise.

`GET /api/learning/state` returns the whole picture in one call —
`{ instant: <tag priors>, durable: <distilled insights>, anomalies }` — and the
distilled insights are surfaced back on every recommendation (`recommend.learned`)
and in the demo's "🧠 What Scout has learned" panel (with 👍/👎 buttons that feed
the loop live).

**Trustworthy by design.** The loop ships with three guard rails:

- **Cold‑start transfer.** A brand‑new family with no history inherits its
  segment's taste from interaction #1 (`getProfile` seeds likes/dislikes from
  `segmentSeed`), so the first recommendation is already tuned, not neutral.
  `GET /api/learning/seed?segment=…` shows the seed. *(Verified: a new
  toddler‑family user scored a shaded splash park 82/Good on its first request.)*
- **"Why this changed."** Every learned adjustment is auditable. The Match Score
  surfaces the single strongest learned driver as a reason (e.g. *learned: "shaded"
  does better with toddler‑family families + hot conditions (+38%)*), and
  `GET /api/learning/explain?tag=…&segment=…&context=…` returns the full breakdown
  (global vs specialized prior, confidence, drivers).
- **Forget / reset / anomaly guard.** `GET /api/learning/anomalies` flags tags whose
  recent feedback swings hard from their long‑run rate (a streak worth a human
  look); `POST /api/learning/forget {tag?,segment?,context?,before?,userId?}` drops
  a bad slice (e.g. one glitchy user); `POST /api/learning/reset` clears all
  interactions (the distilled corpus insights are kept). Combined with the 45‑day
  recency half‑life, a bad streak can't permanently skew the brain.

Together: interactions → learned priors (instant, statistical, fold into the Match
Score at 15%) + auto/­manual prompt‑distilled insights and opt‑in internet research
(durable, human‑readable) → all three make the next answer better. Closed and
in‑house. *(Demonstrated: teaching accept‑shaded / reject‑long‑day moved a shaded
activity up and a long‑day one down with no code change, and the durable insight
auto‑distilled at 10 interactions.)*

## Predictive intelligence (`server/crowdsense/`, `server/companion/`)

- **Scout CrowdSense™** — `POST /api/crowdsense/predict` and `/best-day`: predicts
  crowd level, wait estimate, and the best day/time to go (day‑of‑week, season,
  holidays, venue type). In‑house heuristics.
- **Scout Companion™** — `POST /api/companion/alerts { tripId, weather? }`:
  proactive trip alerts — rain → indoor swap, heat → cooling tips, nap windows
  for little kids, packing reminders, and crowd timing.

## Finder engines (`server/finder/`)

Place finders that stay **intelligent** — every result is ranked by the Scout
Match Score (match % + confidence band + reasons), personalized to the family +
learned behavior. `POST /api/finder/:category { location, familyProfileId?,
userId?, criteria?, weather? }`:

- **Park Finder**, **Playground Finder**, **Beach Finder™** (criteria like
  "toddlers / shelling / sunset / quiet / accessible"), **Restaurant Finder**,
  **Cooling Off Finder™**.
- **Heat trigger** — on hot weather any finder auto‑switches to Cooling Off
  (splash pads / pools / springs / indoor).
- Places are live with `GOOGLE_PLACES_API_KEY` (mock otherwise); the ranking
  intelligence is in‑house.

## Inventory & booking (`server/flights/`, `server/inventory/`, `server/wallet/`)

The Scout brain handles the whole trip, not just flights:

- **Flights** — `POST /api/flights/search` (Duffel) + booking flow (`offer` →
  `payment-intent` → `confirm`), test-mode with a live-key safety guard. See
  `BOOKING.md`.
- **Hotels / Cruises / Activities** — `POST /api/inventory/search {type, ...}` —
  one normalized shape across categories; live with each supplier's key (Duffel
  Stays / Viator / cruise aggregator), mock otherwise.
- **Scout Wallet™ (deals)** — `POST /api/wallet/:userId {memberships:[...]}` then
  pass `userId` to any inventory search: memberships/passes (AAA, AARP, zoo/
  museum/park passes, military, teacher) are applied — matching items shown as
  **included (free)** or **discounted**, and floated to the top. In-house.

## Scout Modes & Scout Harmony (`server/modes/`, `server/harmony/`)

- **Scout Modes** — `GET /api/modes`, `POST /api/modes/:mode/route` — one set of
  options seen through a mode's lens: **Mom Route™** (bathrooms/parking/shade/
  short walks/rest), **Dad Mode™** (adventure, fun per hour), **Grandparent
  Mode™** (accessibility/comfort/rest). Returns a day route with a per‑stop reason.
- **Scout Harmony™** — `POST /api/harmony/decide` — group decisions across several
  people (`participants` with prefs or `familyProfileId`): returns **Best Fit**,
  a **Compromise** (makes the least‑happy person happiest), Budget, and Premium,
  with a per‑person satisfaction breakdown.

## The Lickly framework: Audience → Insights → Recommendation → Execution → Measurement

Scout's decision-intelligence loop, mapped to modules:

| Stage | Scout | Module |
|---|---|---|
| Audience / Segmentation | Family discovery + **User Personas** | `match/behavior.js`, `persona/` |
| Insights | Destination Intelligence | `destination/` |
| Recommendation | Match Score + Decision Layer | `match/`, `decision/` |
| Execution | Trip planning | `decision/` |
| Measurement | Satisfaction analytics | `modules/admin.js` (feedback/traces) |

**Persona / Segmentation** (`server/persona/`) — `POST /api/persona/classify`
classifies a family into a planning persona (Default Planner, Time-Starved
Couple, Multigenerational Organizer, Solo, Local Explorer) and a life stage (New
Parent → Family Builder → Established Family → Empty Nester → Retiree), and emits
recommendation tuning (pace + preferences + priorities) the Decision Layer can
default from.

**Destination Intelligence** (`server/destination/`) — `GET
/api/destination/:name/intel` returns sentiment (community-signals adapter),
**family-fit** (Match Score), what it's best for, likely pain points, and best
season; `POST /api/destination/compare {a, b, familyProfileId}` picks one for a
family and explains why (Scout-style single recommendation).

## Match & Confidence (`server/match/`)

Turns "100 options" into a confident read, and learns each user over time.

- **Scout Match Score** — `POST /api/match/score {target, userId?, familyProfileId?}`
  returns a 0-100 % with a **Decision Confidence band**: Best (≥85) / Good (≥70) /
  Risky (≥50) / Weak. `POST /api/match/rank` ranks many targets.
- **Behavior Learning Loop** — `POST /api/match/behavior {userId, signal}` records
  likes / dislikes / budget / accept / reject; the profile feeds the match score
  so recommendations improve with use (e.g. liking "beach" + disliking "crowds"
  pushed a beach activity 60%→90% and a crowded one to 26% in testing).
- **Experience Prediction** — `POST /api/match/predict` → "Families like yours
  rated this X%" from peers with overlapping likes; falls back to preference-fit
  (clearly labelled) until enough peer ratings exist.
- **Community Signals** — `GET /api/match/signals` (Reddit / Google Reviews /
  social sentiment) behind one guarded adapter: live when keys are set, neutral
  mock in dev, fails loudly under `LIVE_ONLY`. This is the one place Scout reaches
  outside its own data.

## Closed self-learning LMS (`server/lms/`)

A self-contained learning system that grows its own knowledge from ScoutFox
usage — your content, your database, no third-party content platforms. The AI
generation runs through the same swappable `invokeLLM` seam.

- **Corpus** (`corpus.js`) — lessons live in your store; retrieval is in-house
  keyword/TF-IDF scoring (no external embedding service).
- **Self-learning loop** (`distill.js`) — turns saved ScoutFox comparisons
  (answers + synthesis) into vetted lessons + quizzes. `POST /api/lms/learn-all`
  absorbs everything new. This is the "gets smarter every run" bridge to
  ScoutFoxGo.
- **Learner model** (`learner.js`) — per-user mastery by topic, adaptive
  "what to learn next." `userId` is the join key to ScoutFoxGo identity.
- **Tutor** (`tutor.js`) — answers **only** from your corpus. On a miss it says
  so — unless `allowResearch: true`, in which case it does one external research
  pass (Claude web search) and **distills the result back into the corpus**, so
  the next identical question is answered in-house. Research is opt-in; closed
  is the default.

LMS endpoints: `GET /api/lms/lessons`, `POST /api/lms/distill`,
`POST /api/lms/learn-all`, `POST /api/lms/tutor`, `POST /api/lms/quiz/attempt`,
`GET /api/lms/learner/:id`, `GET /api/lms/learner/:id/next`.

## ScoutFoxGo AI modules (`server/modules/` + `server/scoutfoxgo/`)

The AI side of the Scout Fox Go "Missing Modules" addendum, operating on real
ScoutFoxGo entities (the JSON master file in `scoutfoxgo/seed.json` — point
`scoutfoxgo/data.js` at the live DB later, same signatures).

- **Mood AI** (2.6) — reshapes a trip's `trip_days` to a mood + family
  preferences. `POST /api/scout/mood/adapt {tripId, mood, familyProfileId}`
- **Scout Scribe** (2.8) — story-style trip report from trip + days + scrapbook.
  `POST /api/scout/scribe/report {tripId}`
- **Smart Cards** (2.15) — rule-based + AI-flavored daily cards
  (weather/mood/reward/seasonal/tip) with scheduling.
  `POST /api/scout/cards/generate {tripId, weather, mood}`
- **RAG Knowledge Base** (2.7) — admin ingestion on top of the LMS corpus
  (chunking, category, tags, versioning). `POST /api/lms/ingest`, `GET /api/lms/kb`
- **Scout Guide** (2.5) — the closed tutor over that corpus (see LMS above).

- **Administrative AI Tools** (2.9) — analytics, session viewer, feedback
  manager, trace logs for the admin dashboard: `GET /api/admin/analytics`,
  `GET /api/admin/sessions`, `GET /api/admin/traces`, `GET|POST /api/admin/feedback`.

Entity bridge: `GET /api/scout/trips`, `GET /api/scout/trips/:id`,
`GET /api/scout/family`. All generation runs through `invokeLLM`, so it works in
mock mode and stays swappable for a self-hosted model.

**Seed the product spec into the LMS:** `cd server && npm run seed:knowledge`
ingests the Missing Modules Addendum + `LAUNCH_DECISIONS.md` into the closed
corpus, so Scout can answer team questions about the product itself.
See `LAUNCH_DECISIONS.md` for the full 82-question launch decision sheet.

## Adding a real provider (OpenAI / Gemini / Grok / Perplexity)

Open `server/llm.js`, find the provider's `case` in `invokeLLM()`, and return
`{ text, model, mocked: false }` from that provider's SDK — the mock fallback is
right there to replace. Nothing in the frontend changes.
