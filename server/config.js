// config.js — runtime mode flags.
//
// LIVE_ONLY: when true, the system refuses to serve placeholder/mock content.
// Mock LLM answers, mock booking inventory, and the bundled sample data all
// throw instead of returning fake results — so a production deploy can never
// ship "example" data. Leave it off in dev to run fully offline.
export const LIVE_ONLY = /^(1|true|yes|on)$/i.test(process.env.LIVE_ONLY || "");

export function requireLive(what) {
  if (LIVE_ONLY) {
    throw new Error(
      `LIVE_ONLY is set but ${what} is not configured — refusing to serve placeholder data. ` +
        `Provide the required credentials/endpoint, or unset LIVE_ONLY for dev/mock mode.`
    );
  }
}
