// api.js — the browser-side client.
//
// This is the open-source stand-in for the Base44 SDK. Where Base44 code called
// `base44.integrations.Core.InvokeLLM(...)` and `base44.entities.Comparison.*`,
// the frontend now calls these thin helpers, which hit our own /api server.

async function http(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// One model, one answer. Mirrors InvokeLLM({ prompt, model }).
export function invokeLLM({ modelKey, prompt, system }) {
  return http("/api/invoke", {
    method: "POST",
    body: JSON.stringify({ modelKey, prompt, system }),
  });
}

export function saveComparison(record) {
  return http("/api/comparisons", { method: "POST", body: JSON.stringify(record) });
}

export function loadComparison(id) {
  return http(`/api/comparisons/${id}`);
}

export function health() {
  return http("/api/health");
}
