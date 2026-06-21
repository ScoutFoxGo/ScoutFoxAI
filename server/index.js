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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
    res.json({ ...result, ms: Date.now() - started });
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

// In production, serve the built frontend from this same service so the whole
// app lives behind one domain. The static files are produced by `web/` build.
// In dev, the Vite server handles the frontend and proxies /api here instead.
const WEB_DIST = join(__dirname, "..", "web", "dist");
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  // SPA fallback: any non-/api route returns index.html so client-side routes
  // like /share/:id work on a hard refresh.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(WEB_DIST, "index.html")));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? "LIVE Anthropic" : "MOCK (no ANTHROPIC_API_KEY)";
  console.log(`ScoutFoxAI server on http://localhost:${PORT}  [${mode}]`);
});
