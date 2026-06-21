// selftest.js — actively prove each configured provider really connects.
//
// GET /api/selftest pings the providers that have a real implementation (Anthropic,
// Duffel, Stripe) with a cheap authenticated call and reports live / failed /
// not-configured + the error if any. Providers whose adapters are key-gated but
// not actively probed here are reported as "configured" (key present) so you don't
// incur surprise/billable calls. Every probe has a timeout so it can't hang.
//
// Note: this makes OUTBOUND calls, so it only succeeds from a host with internet to
// those providers (your machine / your deploy) — not from a restricted sandbox.

import { invokeLLM, MODEL_CATALOG } from "./llm.js";

const TIMEOUT_MS = 9000;
const res = (status, detail) => ({ status, detail });

async function fetchWithTimeout(url, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function pingAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return res("not-configured", "no ANTHROPIC_API_KEY");
  try {
    const key = MODEL_CATALOG.claude_haiku_4_5 ? "claude_haiku_4_5" : "claude_opus_4_8";
    const r = await invokeLLM({ modelKey: key, prompt: "ping", maxTokens: 4 });
    return r.mocked ? res("failed", "returned a mock answer — key not active") : res("live", `responded via ${r.model}`);
  } catch (e) {
    return res("failed", e.message);
  }
}

async function pingDuffel() {
  if (!process.env.DUFFEL_API_KEY) return res("not-configured", "no DUFFEL_API_KEY");
  try {
    const r = await fetchWithTimeout("https://api.duffel.com/air/airports?limit=1", {
      headers: { Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`, "Duffel-Version": process.env.DUFFEL_VERSION || "v2", Accept: "application/json" },
    });
    if (r.ok) return res("live", `authenticated OK (HTTP ${r.status})`);
    return res("failed", `HTTP ${r.status}: ${(await r.text()).slice(0, 140)}`);
  } catch (e) {
    return res("failed", e.message);
  }
}

async function pingStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return res("not-configured", "no STRIPE_SECRET_KEY");
  const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "test";
  try {
    const r = await fetchWithTimeout("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (r.ok) return res("live", `${mode} key valid (HTTP ${r.status})`);
    const j = await r.json().catch(() => ({}));
    return res("failed", `HTTP ${r.status}: ${j.error?.message || "auth error"}`);
  } catch (e) {
    return res("failed", e.message);
  }
}

export async function runSelfTest() {
  const [anthropic, duffel, stripe] = await Promise.all([pingAnthropic(), pingDuffel(), pingStripe()]);

  // Key-present-but-not-actively-pinged (avoid billable/complex probes).
  const passive = (k) => (process.env[k] ? res("configured", "key present (not actively pinged)") : res("not-configured", "no key"));

  const providers = {
    anthropic_language: anthropic,
    duffel_flights_stays: duffel,
    stripe_payments: stripe,
    viator_activities: passive("VIATOR_API_KEY"),
    getyourguide_activities: passive("GETYOURGUIDE_API_KEY"),
    cruises: passive("CRUISE_API_KEY"),
    google_places: passive("GOOGLE_PLACES_API_KEY"),
    reddit_signals: passive("REDDIT_API_KEY"),
    phptravels: passive("PHPTRAVELS_API_KEY"),
    scoutfoxgo_data: process.env.SCOUTFOXGO_DATA_URL ? res("configured", process.env.SCOUTFOXGO_DATA_URL) : res("not-configured", "using bundled sample seed"),
  };

  const vals = Object.values(providers);
  return {
    checked_at: new Date().toISOString(),
    summary: {
      live: vals.filter((p) => p.status === "live").length,
      failed: vals.filter((p) => p.status === "failed").length,
      configured: vals.filter((p) => p.status === "configured").length,
      not_configured: vals.filter((p) => p.status === "not-configured").length,
    },
    providers,
    note: "live = a real authenticated call succeeded. failed = key present but the call errored (see detail). configured = key present, not actively pinged. Actively pinged: Anthropic, Duffel, Stripe.",
  };
}
