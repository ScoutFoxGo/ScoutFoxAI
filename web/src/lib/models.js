// models.js — the two quality tiers the user toggles between, exactly like
// the Base44 build: Fast (quick, low-cost) vs Advanced (deeper reasoning).
// Grok + Perplexity run on "automatic" (best available) in both tiers.
//
// `key` must match a key in the server's MODEL_CATALOG.

export const TIERS = {
  fast: {
    label: "Fast",
    models: [
      { key: "claude_sonnet_4_6", name: "Claude Sonnet 4.6", color: "#E8662A" },
      { key: "gpt_5_mini", name: "GPT-5 Mini", color: "#10A37F" },
      { key: "gemini_3_flash", name: "Gemini 3 Flash", color: "#4285F4" },
      { key: "grok", name: "Grok", color: "#111111" },
      { key: "perplexity", name: "Perplexity", color: "#20808D" },
    ],
  },
  advanced: {
    label: "Advanced",
    models: [
      { key: "claude_opus_4_8", name: "Claude Opus 4.8", color: "#E8662A" },
      { key: "gpt_5_5", name: "GPT-5.5", color: "#10A37F" },
      { key: "gemini_3_1_pro", name: "Gemini 3.1 Pro", color: "#4285F4" },
      { key: "grok", name: "Grok", color: "#111111" },
      { key: "perplexity", name: "Perplexity", color: "#20808D" },
    ],
  },
};

// Meta-steps (synthesis + judge) always run on a capable Claude model.
export const META_MODEL = "claude_opus_4_8";
