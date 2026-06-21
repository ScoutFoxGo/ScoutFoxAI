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

## Adding a real provider (OpenAI / Gemini / Grok / Perplexity)

Open `server/llm.js`, find the provider's `case` in `invokeLLM()`, and return
`{ text, model, mocked: false }` from that provider's SDK — the mock fallback is
right there to replace. Nothing in the frontend changes.
