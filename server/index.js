// index.js — ScoutFoxAI API server.
//
// Endpoints (all the frontend needs):
//   GET  /api/health                 -> { ok, anthropic }   (is a real key wired up?)
//   GET  /api/models                 -> model catalog for the UI
//   POST /api/invoke   {modelKey, prompt, system}  -> one model's answer
//   POST /api/comparisons            -> save a comparison, returns {id}
//   GET  /api/comparisons/:id        -> load a shared comparison
//   GET  /api/comparisons            -> recent comparisons
//
// The comparison ORCHESTRATION (fan out to N models in parallel, then
// synthesize, then judge) lives in the frontend — exactly like Base44's
// Home.jsx — calling /api/invoke once per step. This keeps the server a thin,
// stateless LLM proxy.

// Load server/.env (or repo-root .env) into process.env BEFORE anything reads it.
// Must be the first import — config.js and others read env at module-eval time.
import { envFile, loadedCount } from "./env.js";

import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { invokeLLM, MODEL_CATALOG, availableBrains } from "./llm.js";
import { saveComparison, getComparison, recentComparisons } from "./store.js";
import lmsRouter from "./lms/routes.js";
import scoutRouter from "./scoutfoxgo/routes.js";
import adminRouter from "./modules/admin.routes.js";
import { logTrace } from "./modules/admin.js";
import decisionRouter from "./decision/routes.js";
import matchRouter from "./match/routes.js";
import personaRouter from "./persona/routes.js";
import destinationRouter from "./destination/routes.js";
import modesRouter from "./modes/routes.js";
import harmonyRouter from "./harmony/routes.js";
import flightsRouter from "./flights/routes.js";
import inventoryRouter, { walletRouter } from "./inventory/routes.js";
import finderRouter from "./finder/routes.js";
import crowdsenseRouter from "./crowdsense/routes.js";
import companionRouter from "./companion/routes.js";
import learningRouter from "./learning/routes.js";
import assistantRouter from "./assistant/routes.js";
import checkoutRouter from "./booking/checkout.routes.js";
import plansRouter from "./plans/routes.js";
import weatherRouter from "./weather/routes.js";
import trackerRouter from "./tracker/routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// CORS: in production set ALLOWED_ORIGINS to the site(s) that call this API
// (e.g. "https://scoutfoxgo.com,https://www.scoutfoxgo.com"). Unset = allow all
// (dev). This is how the main website connects to the AI backend cross-domain.
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : {}));
app.use(express.json({ limit: "2mb" }));

// Optional API-key auth for the dev team's server-to-server calls. Set
// SCOUTFOX_API_KEY and every /api route (except /api/health) requires an
// `X-API-Key` (or `Authorization: Bearer`) header. Unset = open (dev).
const API_KEY = process.env.SCOUTFOX_API_KEY;
const OPEN_PATHS = new Set(["/health", "/status", "/"]); // reachable without a key (monitoring)
app.use("/api", (req, res, next) => {
  if (!API_KEY || OPEN_PATHS.has(req.path)) return next();
  const sent = req.get("x-api-key") || (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (sent === API_KEY) return next();
  res.status(401).json({ error: "missing or invalid API key" });
});

// Branded API root — a discoverable index of the ScoutFoxGo API.
app.get("/api", (_req, res) => {
  res.json({
    name: "ScoutFoxGo API",
    tagline: "Plan Less. Explore More.",
    version: "1.0",
    status: "ok",
    endpoints: {
      assistant: ["POST /api/assistant/message", "GET /api/assistant/session/:id", "POST /api/assistant/session/:id/reset", "POST /api/assistant/session/:id/feedback"],
      checkout: ["POST /api/checkout/cart", "GET /api/checkout/cart/:id", "POST /api/checkout/cart/:id/pay"],
      plans: ["POST /api/plans", "GET /api/plans/:id", "GET /api/plans/:id/calendar.ics"],
      decision: ["POST /api/decision/plan", "POST /api/decision/recommend", "POST /api/decision/refine"],
      match: ["POST /api/match/score", "POST /api/match/predict", "POST /api/match/behavior", "POST /api/match/rank"],
      persona: ["POST /api/persona/classify"],
      destination: ["GET /api/destination/:name/intel", "POST /api/destination/compare"],
      modes: ["GET /api/modes", "POST /api/modes/:mode/route"],
      harmony: ["POST /api/harmony/decide"],
      flights: ["POST /api/flights/search", "GET /api/flights/offer/:id", "POST /api/flights/booking/payment-intent", "POST /api/flights/booking/confirm"],
      inventory: ["GET /api/inventory/types", "POST /api/inventory/search"],
      wallet: ["GET /api/wallet/programs", "GET /api/wallet/:userId", "POST /api/wallet/:userId", "POST /api/wallet/:userId/apply"],
      finder: ["GET /api/finder/categories", "POST /api/finder/:category"],
      weather: ["GET /api/weather/:place"],
      tracker: ["GET /api/tracker", "POST /api/tracker/items", "PATCH /api/tracker/items/:id", "DELETE /api/tracker/items/:id", "POST /api/tracker/phases", "POST /api/tracker/reset"],
      crowdsense: ["POST /api/crowdsense/predict", "POST /api/crowdsense/best-day"],
      companion: ["POST /api/companion/alerts", "POST /api/companion/notify"],
      learning: ["POST /api/learning/outcome", "GET /api/learning/knowledge", "GET /api/learning/state", "POST /api/learning/distill", "POST /api/learning/research", "GET /api/learning/explain", "GET /api/learning/seed", "GET /api/learning/anomalies", "POST /api/learning/forget", "POST /api/learning/reset"],
      guide: ["POST /api/lms/tutor", "POST /api/lms/ingest", "GET /api/lms/kb", "GET /api/lms/lessons"],
      lms_core: ["GET /api/lms/courses", "POST /api/lms/courses", "GET /api/lms/courses/:id", "POST /api/lms/courses/:id/enroll", "GET /api/lms/courses/:id/next", "POST /api/lms/courses/:id/submit", "GET /api/lms/courses/:id/progress", "GET /api/lms/learner/:userId", "GET /api/lms/learner/:userId/due"],
      scout: ["POST /api/scout/mood/adapt", "POST /api/scout/scribe/report", "POST /api/scout/cards/generate"],
      admin: ["GET /api/admin/analytics", "GET /api/admin/sessions", "GET /api/admin/traces"],
      health: ["GET /api/health", "GET /api/status", "GET /api/selftest", "GET /api/brain"],
    },
    pages: ["/assistant.html", "/learn.html", "/tracker.html", "/demo.html", "/checkout.html", "/plan.html"],
    docs: "See HANDOFF.md in the repository.",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, local: Boolean(process.env.LOCAL_LLM_URL), anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY), brains: availableBrains() });
});

// Scout's own brain: which LLM providers it can run on + the active order.
app.get("/api/brain", (_req, res) => {
  const brains = availableBrains();
  const pref = String(process.env.SCOUT_BRAIN || "auto").toLowerCase();
  const order = pref === "claude" ? ["claude", "openai", "local"] : pref === "openai" ? ["openai", "claude", "local"] : ["local", "claude", "openai"];
  const independent = brains.includes("local");
  res.json({
    runs_on: brains.length ? brains : ["mock (no provider configured)"],
    preference: pref,
    order: order.filter((p) => brains.includes(p)).concat(order.filter((p) => !brains.includes(p)).map((p) => `${p} (not configured)`)),
    independent_of_hosted_ai: independent,
    self_hosted: independent ? { url: process.env.LOCAL_LLM_URL, model: process.env.LOCAL_LLM_MODEL || "llama3.1" } : null,
    fallback: brains.length > 1 ? "automatic — if one provider fails, Scout falls back to the next" : brains.length === 1 ? `single provider (${brains[0]}); add another for failover` : "none — running on offline mock",
    note: independent ? "Running on your own model; hosted providers are optional backup only." : "Set LOCAL_LLM_URL (e.g. Ollama) to run with no Claude/OpenAI dependency.",
  });
});

// A one-glance "is it really live?" report — which keys were picked up and what's
// still mock. Used by the boot log too. No key required (handy for monitoring).
function integrationStatus() {
  const has = (k) => Boolean(process.env[k]);
  const stripe = !process.env.STRIPE_SECRET_KEY ? "mock" : process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "test";
  const brains = [has("LOCAL_LLM_URL") && "local", has("ANTHROPIC_API_KEY") && "claude", has("OPENAI_API_KEY") && "openai"].filter(Boolean);
  return {
    brain: brains.length ? `live (${brains.join(" + ")})` : "mock",
    brain_independent: brains.includes("local"),
    language_local: has("LOCAL_LLM_URL") ? "live" : "off",
    language_anthropic: has("ANTHROPIC_API_KEY") ? "live" : "mock",
    language_openai: has("OPENAI_API_KEY") ? "live" : "mock",
    scoutfoxgo_data: has("SCOUTFOXGO_DATA_URL") ? "live" : "sample-seed",
    flights_stays_duffel: has("DUFFEL_API_KEY") ? "live" : "mock",
    hotels_booking: has("BOOKING_API_KEY") ? "live" : "mock",
    hotels_expedia: has("EXPEDIA_API_KEY") && has("EXPEDIA_SHARED_SECRET") ? "live" : "mock",
    payments_stripe: stripe,
    activities_viator: has("VIATOR_API_KEY") ? "live" : "mock",
    activities_getyourguide: has("GETYOURGUIDE_API_KEY") ? "live" : "mock",
    cruises: has("CRUISE_API_KEY") ? "live" : "mock",
    places_google: has("GOOGLE_PLACES_API_KEY") ? "live" : "mock",
    parks_nps: has("NPS_API_KEY") ? "live" : "mock",
    weather_openweather: has("OPENWEATHER_API_KEY") ? "live" : "mock",
    signals_reddit: has("REDDIT_API_KEY") ? "live" : "mock",
  };
}

// Actively ping each configured provider (Anthropic, Duffel, Stripe) and report
// live/failed/not-configured. Makes outbound calls — succeeds from a host with
// internet to those providers. Behind the API key when SCOUTFOX_API_KEY is set.
app.get("/api/selftest", async (_req, res) => {
  try {
    const { runSelfTest } = await import("./selftest.js");
    res.json(await runSelfTest());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/status", (_req, res) => {
  const integrations = integrationStatus();
  const liveCount = Object.values(integrations).filter((v) => v === "live" || v === "test" || v === "LIVE").length;
  res.json({
    name: "ScoutFoxAI",
    version: "1.0",
    mode: /^(1|true|yes|on)$/i.test(process.env.LIVE_ONLY || "") ? "LIVE_ONLY" : "dev",
    allow_live_payments: process.env.ALLOW_LIVE_PAYMENTS === "true",
    env_file_loaded: envFile || null,
    env_vars_loaded: loadedCount,
    integrations,
    live_count: liveCount,
    all_live: liveCount === Object.keys(integrations).length,
    note: liveCount ? `${liveCount} integration(s) live; the rest run on mock data until you add their keys (see API_KEYS.md).` : "Running fully on mock data. Add keys to server/.env to go live.",
  });
});

app.get("/api/models", (_req, res) => {
  const models = Object.fromEntries(
    Object.entries(MODEL_CATALOG).map(([key, v]) => [key, { label: v.label, provider: v.provider }])
  );
  res.json({ models });
});

app.post("/api/invoke", async (req, res) => {
  const { modelKey, prompt, system, maxTokens } = req.body || {};
  if (!modelKey || !prompt) {
    return res.status(400).json({ error: "modelKey and prompt are required" });
  }
  try {
    const started = Date.now();
    const result = await invokeLLM({ modelKey, prompt, system, maxTokens });
    const ms = Date.now() - started;
    logTrace({ kind: "invoke", model: result.model, modelKey, ms, mocked: result.mocked });
    res.json({ ...result, ms });
  } catch (err) {
    console.error(`invoke failed for ${modelKey}:`, err.message);
    res.status(502).json({ error: err.message, model: modelKey });
  }
});

app.post("/api/comparisons", (req, res) => {
  const record = req.body || {};
  if (!record.prompt) return res.status(400).json({ error: "prompt is required" });
  res.json(saveComparison(record));
});

app.get("/api/comparisons/:id", (req, res) => {
  const found = getComparison(req.params.id);
  if (!found) return res.status(404).json({ error: "not found" });
  res.json(found);
});

app.get("/api/comparisons", (_req, res) => {
  res.json({ comparisons: recentComparisons() });
});

// Closed, self-learning LMS (corpus + self-learning loop + learner model +
// closed-first tutor with opt-in research). Bridges to ScoutFoxGo via userId.
app.use("/api/lms", lmsRouter);

// ScoutFoxGo AI modules (Mood AI, Scout Scribe, Smart Cards) operating on real
// ScoutFoxGo trip/family entities — the AI side of the Missing Modules addendum.
app.use("/api/scout", scoutRouter);

// Administrative AI Tools (analytics, sessions, feedback, traces) for the admin
// dashboard (Addendum 2.9).
app.use("/api/admin", adminRouter);

// The Decision Layer — the core recommendation engine (Understand -> Gather ->
// Reason -> Compose -> Refine) over family profiles + booking integrations.
app.use("/api/decision", decisionRouter);

// Match & Confidence: Scout Match Score, Decision Confidence bands, Experience
// Prediction, and the Behavior Learning Loop.
app.use("/api/match", matchRouter);

// Persona/Segmentation (Audience Segmentation -> User Personas) and Destination
// Intelligence (Competitive Intelligence -> Destination Intelligence).
app.use("/api/persona", personaRouter);
app.use("/api/destination", destinationRouter);

// Scout Modes (Mom Route / Dad Mode / Grandparent Mode) and Scout Harmony
// (group decisions).
app.use("/api/modes", modesRouter);
app.use("/api/harmony", harmonyRouter);

// Real flight search via Duffel (live with DUFFEL_API_KEY).
app.use("/api/flights", flightsRouter);

// Unified inventory (hotels/cruises/activities) + Scout Wallet (membership deals).
app.use("/api/inventory", inventoryRouter);
app.use("/api/wallet", walletRouter);

// Finder engines (parks/playgrounds/beaches/restaurants/cooling-off) — every
// result ranked by the Scout Match Score.
app.use("/api/finder", finderRouter);

// Predictive intelligence: CrowdSense (crowd/wait/best-day) + Companion (alerts).
app.use("/api/crowdsense", crowdsenseRouter);
app.use("/api/companion", companionRouter);

// Self-learning loop: record outcomes -> learned priors (fed into Match Score) +
// prompt-distilled insights into the closed corpus.
app.use("/api/learning", learningRouter);

// The standalone product front door: a stateful conversational planning assistant
// that orchestrates the whole brain (understand -> plan -> refine -> learn).
app.use("/api/assistant", assistantRouter);

// Booking checkout (cart -> Stripe payment -> Duffel order, TEST MODE) and
// saved/shareable plans.
app.use("/api/checkout", checkoutRouter);
app.use("/api/plans", plansRouter);

// Live weather (OpenWeather) — feeds planning + alerts when OPENWEATHER_API_KEY set.
app.use("/api/weather", weatherRouter);

// Live, self-owned project tracker (UI at /tracker.html) — replaces a static mirror.
app.use("/api/tracker", trackerRouter);

// In production, serve the built frontend from this same service so the whole
// app lives behind one domain. The static files are produced by `web/` build.
// In dev, the Vite server handles the frontend and proxies /api here instead.
// Standalone demo page (no build step) — visit /demo.html.
app.use(express.static(join(__dirname, "public")));

const WEB_DIST = join(__dirname, "..", "web", "dist");
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  // SPA fallback: any non-/api route returns index.html so client-side routes
  // like /share/:id work on a hard refresh.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(WEB_DIST, "index.html")));
}

const PORT = process.env.PORT || 8787;

// Load ScoutFoxGo data (live endpoint if configured, sample seed in dev) before
// serving, so the engine never races an empty dataset.
const { initData } = await import("./scoutfoxgo/data.js");
let dataSource = "unknown";
try {
  const r = await initData();
  dataSource = r.source + (r.url ? ` (${r.url})` : "");
} catch (e) {
  console.error(`Data init failed: ${e.message}`);
  if (process.env.LIVE_ONLY) process.exit(1); // don't serve placeholders in live mode
}

app.listen(PORT, () => {
  const ai = process.env.ANTHROPIC_API_KEY ? "LIVE Anthropic" : "mock LLM";
  const mode = /^(1|true|yes|on)$/i.test(process.env.LIVE_ONLY || "") ? "LIVE_ONLY" : "dev";
  console.log(`ScoutFoxAI server on http://localhost:${PORT}  [${mode}; ${ai}; data: ${dataSource}]`);
  if (envFile) console.log(`  env: loaded ${loadedCount} var(s) from ${envFile}`);

  // Live-integration summary, so you can confirm which keys were picked up in the
  // real world. Mirrors GET /api/status. "mock"/"sample-seed" = no key yet.
  const live = Object.entries(integrationStatus()).filter(([, v]) => v !== "mock" && v !== "sample-seed").map(([k, v]) => `${k}:${v}`);
  console.log(`  integrations live: ${live.length ? live.join(", ") : "none yet (running on mock data — add keys in server/.env)"}`);
});
