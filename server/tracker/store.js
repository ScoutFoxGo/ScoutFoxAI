// store.js — a live, self-owned project tracker (replaces a static mirror).
//
// Tasks grouped into phases, each with a status. Persisted in the in-house JSON
// store, edited in real time through /api/tracker — so it's a genuinely LIVE
// tracker you own and deploy with the rest of ScoutFoxAI (no static-host limits,
// no Basecamp dependency). Seeds with the ScoutFoxGo roadmap + dev checklist.

import { load, save } from "../lms/jsondb.js";

const FILE = "tracker";
const newId = () => "t_" + Math.random().toString(36).slice(2, 9);
export const STATUSES = ["todo", "doing", "done"];
const DEFAULT_PHASES = ["Dev & Build", "AI Models", "Compliance & GDPR", "Launch & Beta", "Marketing & Partnerships", "Mobile"];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const stamp = () => new Date().toISOString();

function seedBoard() {
  const items = [];
  const add = (title, phase, status = "todo") =>
    items.push({ id: newId(), title, phase, status, notes: "", order: items.length, created_at: stamp(), updated_at: stamp() });

  add("Deploy the backend to Render (render.yaml) for a live URL", "Dev & Build");
  add("Add API keys to server/.env (ANTHROPIC / DUFFEL / STRIPE / …)", "Dev & Build");
  add("npm run setup → npm start → verify GET /api/status & /api/selftest", "Dev & Build");
  add("Connect a custom domain (api.scoutfox.ai / scoutfoxai.com)", "Dev & Build");
  add("Seed Scout's startup knowledge (npm run seed:knowledge)", "Dev & Build", "done");
  add("Self-hosted brain option wired (LOCAL_LLM_URL, Claude/OpenAI backup)", "Dev & Build", "done");
  add("Deploy live on Render (scoutfoxai.onrender.com)", "Dev & Build", "done");

  // AI Models — add 4 more providers to the brain/comparison (Claude + OpenAI exist)
  add("Wire Google Gemini adapter (real, key-gated, mock-safe)", "AI Models");
  add("Wire xAI Grok adapter", "AI Models");
  add("Wire Perplexity adapter", "AI Models");
  add("Wire a self-hosted open model (Llama/Mistral via Ollama)", "AI Models");
  add("Multi-model comparison UI: fan-out → synthesis → AI judge", "AI Models");
  add("Per-model routing: cheap model for parsing, strong model for reasoning", "AI Models");

  // Compliance & GDPR — the gatekeepers, especially before data leaves to any model
  add("PII gatekeeper: redact/minimize personal data BEFORE sending to any external AI model", "Compliance & GDPR");
  add("Sign DPAs with each AI provider + enable training opt-out (Anthropic/OpenAI/Gemini/etc.)", "Compliance & GDPR");
  add("Consent gate: capture explicit consent for AI processing + data use", "Compliance & GDPR");
  add("Right to access / export: endpoint to export a user's data", "Compliance & GDPR");
  add("Right to erasure: delete a user's data across all stores on request", "Compliance & GDPR");
  add("Children's data: parental consent + special-category handling (GDPR-K / COPPA)", "Compliance & GDPR");
  add("Privacy policy + Records of Processing + EU data-residency review", "Compliance & GDPR");

  add("Recruit Founding Families beta testers", "Launch & Beta");
  add("Collect feedback + validate the planning value", "Launch & Beta");
  add("Improve the product from beta feedback", "Launch & Beta");

  add("Outreach: tourism boards, museums, parks, schools, municipalities", "Marketing & Partnerships");
  add("LinkedIn thought-leadership content", "Marketing & Partnerships");
  add("Set up affiliate partners (Booking.com, Expedia)", "Marketing & Partnerships");

  add("Build iOS + Android app after web validation", "Mobile");

  return { phases: DEFAULT_PHASES, items, created_at: stamp() };
}

export function getBoard() {
  let d = load(FILE, null);
  if (!d) { d = seedBoard(); save(FILE, d); }
  return d;
}

export function summary() {
  const d = getBoard();
  const by = Object.fromEntries(STATUSES.map((s) => [s, d.items.filter((i) => i.status === s).length]));
  const pct = d.items.length ? Math.round((100 * by.done) / d.items.length) : 0;
  return { total: d.items.length, by_status: by, percent_done: pct, phases: d.phases };
}

export function addItem({ title, phase, status = "todo", notes = "" } = {}) {
  if (!title) throw new Error("title required");
  const d = getBoard();
  if (!d.phases.includes(phase)) phase = d.phases[0];
  const item = { id: newId(), title, phase, status: STATUSES.includes(status) ? status : "todo", notes, order: d.items.length, created_at: stamp(), updated_at: stamp() };
  d.items.push(item);
  save(FILE, d);
  return item;
}

export function updateItem(id, patch = {}) {
  const d = getBoard();
  const it = d.items.find((i) => i.id === id);
  if (!it) throw new Error("item not found");
  if (patch.status && !STATUSES.includes(patch.status)) throw new Error(`status must be one of: ${STATUSES.join(", ")}`);
  if (patch.phase && !d.phases.includes(patch.phase)) d.phases.push(patch.phase);
  Object.assign(it, pick(patch, ["title", "phase", "status", "notes", "order"]), { updated_at: stamp() });
  save(FILE, d);
  return it;
}

export function deleteItem(id) {
  const d = getBoard();
  const before = d.items.length;
  d.items = d.items.filter((i) => i.id !== id);
  save(FILE, d);
  return { removed: before - d.items.length };
}

export function addPhase(name) {
  const d = getBoard();
  if (name && !d.phases.includes(name)) { d.phases.push(name); save(FILE, d); }
  return d.phases;
}

// Reset to the seeded roadmap (handy when starting fresh).
export function resetBoard() {
  const d = seedBoard();
  save(FILE, d);
  return d;
}
