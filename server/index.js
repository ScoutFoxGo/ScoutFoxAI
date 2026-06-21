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

import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { invokeLLM, MODEL_CATALOG } from "./llm.js";
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
app.use("/api", (req, res, next) => {
  if (!API_KEY || req.path === "/health" || req.path === "/") return next();
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
      decision: ["POST /api/decision/plan", "POST /api/decision/recommend", "POST /api/decision/refine"],
      match: ["POST /api/match/score", "POST /api/match/predict", "POST /api/match/behavior", "POST /api/match/rank"],
      persona: ["POST /api/persona/classify"],
      destination: ["GET /api/destination/:name/intel", "POST /api/destination/compare"],
      modes: ["GET /api/modes", "POST /api/modes/:mode/route"],
      harmony: ["POST /api/harmony/decide"],
      flights: ["POST /api/flights/search"],
      guide: ["POST /api/lms/tutor", "POST /api/lms/ingest", "GET /api/lms/kb"],
      scout: ["POST /api/scout/mood/adapt", "POST /api/scout/scribe/report", "POST /api/scout/cards/generate"],
      admin: ["GET /api/admin/analytics", "GET /api/admin/sessions", "GET /api/admin/traces"],
      health: ["GET /api/health"],
    },
    docs: "See HANDOFF.md in the repository.",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, anthropic: Boolean(process.env.ANTHROPIC_API_KEY) });
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
});
