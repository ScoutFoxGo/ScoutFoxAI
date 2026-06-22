// llm.js — the multi-provider LLM layer.
//
// This is the open-source replacement for Base44's hosted
// `base44.integrations.Core.InvokeLLM(...)`. Every model the ScoutFox
// comparison engine talks to flows through `invokeLLM()` here.
//
// Anthropic models (Claude) call the real API when ANTHROPIC_API_KEY is set.
// The other providers (OpenAI, Google, xAI/Grok, Perplexity) have adapter
// slots; until you wire in their SDKs/keys they fall back to a deterministic
// offline mock so the whole app runs with zero credentials. Swap a mock for a
// real adapter by filling in the matching `case` below — nothing else changes.

import Anthropic from "@anthropic-ai/sdk";
import { requireLive } from "./config.js";

// Catalog of every model the UI can select, keyed by a stable `key`.
// `provider` decides which adapter handles the call; `apiModel` is the exact
// model string passed to that provider.
export const MODEL_CATALOG = {
  // --- Anthropic (real when ANTHROPIC_API_KEY is present) ---
  claude_opus_4_8: { label: "Claude Opus 4.8", provider: "anthropic", apiModel: "claude-opus-4-8" },
  claude_sonnet_4_6: { label: "Claude Sonnet 4.6", provider: "anthropic", apiModel: "claude-sonnet-4-6" },
  claude_haiku_4_5: { label: "Claude Haiku 4.5", provider: "anthropic", apiModel: "claude-haiku-4-5" },

  // --- Other providers (mock until you add an adapter + key) ---
  gpt_5_5: { label: "GPT-5.5", provider: "openai", apiModel: "gpt-5.5" },
  gpt_5_mini: { label: "GPT-5 Mini", provider: "openai", apiModel: "gpt-5-mini" },
  gemini_3_1_pro: { label: "Gemini 3.1 Pro", provider: "google", apiModel: "gemini-3.1-pro" },
  gemini_3_flash: { label: "Gemini 3 Flash", provider: "google", apiModel: "gemini-3-flash" },
  grok: { label: "Grok", provider: "xai", apiModel: "grok-automatic" },
  perplexity: { label: "Perplexity", provider: "perplexity", apiModel: "sonar-automatic" },
};

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/**
 * Call a single model and return { text, model, mocked }.
 * @param {object} args
 * @param {string} args.modelKey  one of MODEL_CATALOG keys
 * @param {string} args.prompt    user prompt
 * @param {string} [args.system]  optional system prompt
 * @param {number} [args.maxTokens]
 */
export async function invokeLLM({ modelKey, prompt, system, maxTokens = 2048 }) {
  const entry = MODEL_CATALOG[modelKey];
  if (!entry) throw new Error(`Unknown model: ${modelKey}`);

  switch (entry.provider) {
    case "anthropic":
      if (anthropic) {
        return { ...(await callAnthropic(entry.apiModel, prompt, system, maxTokens)), model: entry.label };
      }
      requireLive(`${entry.label} (ANTHROPIC_API_KEY)`); // throws in LIVE_ONLY mode
      // Dev only — labelled mock so the app runs offline.
      return { text: mockAnswer(entry.label, prompt), model: entry.label, mocked: true };

    // To make these real: construct the provider's client and return its text.
    case "openai":
      if (process.env.OPENAI_API_KEY) {
        return { ...(await callOpenAI(entry.apiModel, prompt, system, maxTokens)), model: entry.label };
      }
      requireLive(`${entry.label} (OPENAI_API_KEY)`);
      return { text: mockAnswer(entry.label, prompt), model: entry.label, mocked: true };

    case "google":
    case "xai":
    case "perplexity":
    default:
      requireLive(`${entry.label} provider`); // throws in LIVE_ONLY mode
      return { text: mockAnswer(entry.label, prompt), model: entry.label, mocked: true };
  }
}

// --- Scout's own brain: provider-agnostic, RUNS ON BOTH Claude and OpenAI -------
//
// `think()` is what the Scout brain (assistant, decision engine, distillation)
// calls instead of pinning a single vendor. It picks an available provider, and if
// that call fails (outage, rate limit, bad key) it automatically falls back to the
// next — so Scout keeps thinking as long as ANY provider is configured, and runs
// fully offline (labelled mock) when none is.
//
// INDEPENDENCE: a self-hosted "local" provider (Ollama / llama.cpp / vLLM / LM
// Studio — anything exposing an OpenAI-compatible endpoint at LOCAL_LLM_URL) lets
// Scout run with NO Claude/OpenAI/Gemini at all. Order is set by SCOUT_BRAIN
// (local | claude | openai | auto). Default auto = your own model first, then
// Claude, then OpenAI as backup.

const OPENAI_BRAIN_MODEL = () => process.env.OPENAI_MODEL || "gpt-4o-mini";
const LOCAL_BRAIN_MODEL = () => process.env.LOCAL_LLM_MODEL || "llama3.1";

export function availableBrains() {
  const list = [];
  if (process.env.LOCAL_LLM_URL) list.push("local");
  if (process.env.ANTHROPIC_API_KEY) list.push("claude");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

function brainOrder(prefer) {
  const pref = String(prefer || process.env.SCOUT_BRAIN || "auto").toLowerCase();
  if (pref === "claude") return ["claude", "openai", "local"];
  if (pref === "openai") return ["openai", "claude", "local"];
  if (pref === "local") return ["local", "claude", "openai"];
  return ["local", "claude", "openai"]; // auto — own model first, hosted as backup
}

export async function think({ prompt, system, maxTokens = 600, prefer } = {}) {
  const order = brainOrder(prefer);
  let lastErr = null;
  let usedFallback = false;
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    try {
      if (p === "local" && process.env.LOCAL_LLM_URL) {
        const model = LOCAL_BRAIN_MODEL();
        const r = await callLocal(model, prompt, system, maxTokens);
        return { ...r, provider: "local", model, fallback: usedFallback };
      }
      if (p === "claude" && anthropic) {
        const r = await callAnthropic("claude-opus-4-8", prompt, system, maxTokens);
        return { ...r, provider: "claude", model: "Claude Opus 4.8", fallback: usedFallback };
      }
      if (p === "openai" && process.env.OPENAI_API_KEY) {
        const model = OPENAI_BRAIN_MODEL();
        const r = await callOpenAI(model, prompt, system, maxTokens);
        return { ...r, provider: "openai", model, fallback: usedFallback };
      }
      continue; // provider not configured — try the next
    } catch (e) {
      lastErr = e;
      usedFallback = true; // this provider failed; the next attempt is a fallback
    }
  }
  requireLive("Scout brain (LOCAL_LLM_URL / ANTHROPIC_API_KEY / OPENAI_API_KEY)"); // throws in LIVE_ONLY
  return { text: mockAnswer("Scout", prompt), model: "Scout (mock)", provider: "mock", mocked: true, error: lastErr?.message };
}

/**
 * Research fallback: answer a question using live web search, for when the
 * closed corpus doesn't know. This is the ONE place the system reaches outside
 * — callers gate it behind an explicit flag so "closed" stays the default.
 * Returns { text, mocked }.
 */
export async function researchLLM(question, { maxTokens = 1500 } = {}) {
  if (!anthropic) {
    requireLive("research (ANTHROPIC_API_KEY + web search)"); // throws in LIVE_ONLY
    return {
      text:
        `*(Research is simulated — set ANTHROPIC_API_KEY to enable live web search.)*\n\n` +
        `A researched summary of "${question}" would go here, then be saved into ` +
        `your corpus so the next answer is in-house.`,
      mocked: true,
    };
  }
  const res = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: maxTokens,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      {
        role: "user",
        content:
          `Research this and write a tight, factual summary with the key points ` +
          `someone should learn. Question: ${question}`,
      },
    ],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, mocked: false };
}

async function callAnthropic(apiModel, prompt, system, maxTokens) {
  // Non-streaming keeps the proxy simple; max_tokens stays well under the
  // SDK's ~16K non-streaming timeout guard. Bump this + switch to streaming
  // if you need long outputs.
  const res = await anthropic.messages.create({
    model: apiModel,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, mocked: false };
}

// OpenAI Chat Completions via fetch (no extra SDK). Real when OPENAI_API_KEY set.
async function callOpenAI(apiModel, prompt, system, maxTokens) {
  return chatCompletion({ baseUrl: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY, model: apiModel, prompt, system, maxTokens, label: "OpenAI" });
}

// Self-hosted / local model via an OpenAI-compatible endpoint (Ollama, llama.cpp
// server, vLLM, LM Studio, etc.). LOCAL_LLM_URL is the base, e.g.
// "http://localhost:11434/v1" for Ollama. No key needed (optional LOCAL_LLM_KEY).
async function callLocal(model, prompt, system, maxTokens) {
  const baseUrl = String(process.env.LOCAL_LLM_URL).replace(/\/$/, "");
  return chatCompletion({ baseUrl, apiKey: process.env.LOCAL_LLM_KEY || null, model, prompt, system, maxTokens, label: "Local LLM" });
}

// Shared OpenAI-compatible chat call used by both OpenAI and the local provider.
async function chatCompletion({ baseUrl, apiKey, model, prompt, system, maxTokens, label }) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${label} ${r.status}: ${j.error?.message || "error"}`);
  return { text: j.choices?.[0]?.message?.content || "", mocked: false };
}

// Deterministic, clearly-labelled placeholder so the comparison UI is fully
// functional offline. Real adapters replace this per provider.
function mockAnswer(label, prompt) {
  const topic = prompt.trim().slice(0, 140).replace(/\s+/g, " ");
  return (
    `*(${label} — simulated response; add this provider's API key to get a real answer.)*\n\n` +
    `Here is how ${label} would approach: "${topic}".\n\n` +
    `1. Restate the goal and the key constraints.\n` +
    `2. Lay out the main options and the tradeoffs between them.\n` +
    `3. Give a concrete recommendation with the reasoning behind it.\n\n` +
    `In short: a focused, ${label}-flavored take that you can compare side by side ` +
    `against the other models in ScoutFox.`
  );
}
