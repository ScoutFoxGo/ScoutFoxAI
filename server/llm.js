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
      // No key — fall through to a labelled mock so the demo still runs.
      return { text: mockAnswer(entry.label, prompt), model: entry.label, mocked: true };

    // To make these real: construct the provider's client and return its text.
    // e.g. case "openai": return { ...(await callOpenAI(...)), model: entry.label };
    case "openai":
    case "google":
    case "xai":
    case "perplexity":
    default:
      return { text: mockAnswer(entry.label, prompt), model: entry.label, mocked: true };
  }
}

/**
 * Research fallback: answer a question using live web search, for when the
 * closed corpus doesn't know. This is the ONE place the system reaches outside
 * — callers gate it behind an explicit flag so "closed" stays the default.
 * Returns { text, mocked }.
 */
export async function researchLLM(question, { maxTokens = 1500 } = {}) {
  if (!anthropic) {
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
