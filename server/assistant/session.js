// session.js — conversational planning sessions for the Scout assistant.
//
// A standalone product needs memory across turns: who's going, where, the budget,
// the plan so far, and what's already been asked. This is that working memory —
// one record per conversation, persisted in the in-house JSON store so a session
// survives a refresh. No external service.

import { load, save } from "../lms/jsondb.js";

const FILE = "assistant_sessions";
const newId = () => "s_" + Math.random().toString(36).slice(2, 10);

// A fresh conversation. `intent` is the evolving slot-filled trip request; `plan`
// is the most recent composed plan; `asked` tracks clarifying questions already
// posed so the assistant never repeats itself.
function blank(id) {
  return {
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stage: "greeting", // greeting -> gathering -> planned -> refining
    messages: [],
    intent: { request: "", destination: null, days: null, budget: null, pace: null, prefs: [], must_haves: [], hard_nos: [], party: null, dates: null, weather: null, familyProfileId: null, segment: null, persona: null },
    asked: [],
    plan: null,
  };
}

export function getSession(id) {
  const db = load(FILE, {});
  if (id && db[id]) return db[id];
  const s = blank(id || newId());
  db[s.id] = s;
  save(FILE, db);
  return s;
}

export function saveSession(s) {
  s.updated_at = new Date().toISOString();
  const db = load(FILE, {});
  db[s.id] = s;
  save(FILE, db);
  return s;
}

export function resetSession(id) {
  const db = load(FILE, {});
  const s = blank(id);
  db[id] = s;
  save(FILE, db);
  return s;
}

export function pushMessage(s, role, text, extra = {}) {
  s.messages.push({ role, text, ts: Date.now(), ...extra });
  if (s.messages.length > 200) s.messages.splice(0, s.messages.length - 200);
  return s;
}
