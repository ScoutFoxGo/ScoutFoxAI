// assistant.js — the Scout planning assistant: a stateful conversational agent.
//
// This is the standalone product's "front door." It turns a free-form chat into a
// real plan by orchestrating the whole brain: it slot-fills a trip request across
// turns, classifies the family persona, calls the Decision Layer to compose a
// day-by-day plan, refines it conversationally, and feeds accept/reject back into
// the self-learning loop. Deterministic and fully offline; when an Anthropic key
// is present it polishes replies into Scout's voice (never inventing facts).

import { understand, reason, compose, recommend, applyFeedback } from "../decision/engine.js";
import { gatherOptions } from "../booking/index.js";
import { classify } from "../persona/classify.js";
import { compare as compareDestinations } from "../destination/intel.js";
import { recordOutcome } from "../learning/loop.js";
import { createCartFromPlan } from "../booking/cart.js";
import { savePlan } from "../plans/store.js";
import { invokeLLM } from "../llm.js";
import { SCOUT_SYSTEM_PROMPT } from "../scout/persona.js";
import { getSession, saveSession, resetSession, pushMessage } from "./session.js";

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");
const titlecase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// --- lightweight slot extractors (only set a slot the user actually mentioned) ---
const STOP = new Set(
  ("the a an for with and to in on at this that weekend trip vacation getaway holiday my our me us kids family there here please " +
   "plan plans planning go going goes see seeing do does eat find finding visit explore relax book travel get take taking head heading " +
   "spend stay staying have having make making check want need like love think thinking figure sort somewhere anywhere place places " +
   "something nice warm cold cheap fun " +
   "grandma grandpa grandparent grandparents nana papa mom dad mum mother father toddler toddlers baby infant newborn " +
   "teen teens wife husband partner spouse everyone adults adult couple kid children " +
   "compare vs versus between or either")
    .split(" ")
);

function readDestination(text) {
  const m = text.match(/\b(?:to|in|near|around|visit|visiting|going to|head(?:ing)? to|explore)\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  if (m) {
    const words = m[1].trim().split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).slice(0, 3);
    if (words.length) return titlecase(words.join(" "));
  }
  return null;
}
function readDays(t) {
  const m = t.match(/(\d+)\s*(?:-|\s)?\s*(?:day|night)/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  if (/\bweekend\b/i.test(t)) return 2;
  if (/day trip/i.test(t)) return 1;
  if (/\bweek\b/i.test(t)) return 5;
  return null;
}
function readBudget(t) {
  if (/(cheap|budget|affordable|save money|low cost|inexpensive|tight)/i.test(t)) return "Low";
  if (/(luxury|splurge|premium|high-end|fancy|treat ourselves)/i.test(t)) return "Higher";
  if (/(mid|moderate|reasonable)/i.test(t)) return "Medium";
  return null;
}
function readPace(t) {
  if (/(relax|slow|chill|easy|low-key|calm|laid-back|down ?time)/i.test(t)) return "relaxed";
  if (/(adventur|packed|action|busy|see everything|do everything|active|fast)/i.test(t)) return "adventurous";
  if (/(balanc|mix)/i.test(t)) return "balanced";
  return null;
}
function readWeather(t) {
  const m = t.toLowerCase().match(/\b(sunny|rain|rainy|hot|heat|cold|snow|storm|warm)\b/);
  return m ? m[1] : null;
}
function readParty(text) {
  const t = text.toLowerCase();
  const kids = [];
  const who = [];
  for (const m of t.matchAll(/age\s*(\d{1,2})/g)) kids.push(`age ${m[1]}`);
  if (/toddler/.test(t)) kids.push("age 2");
  if (/baby|infant|newborn/.test(t)) kids.push("age 1");
  if (/preschool/.test(t)) kids.push("age 4");
  if (/teen/.test(t)) kids.push("age 14");
  if (/\bkids?\b|children|little ones/.test(t) && !kids.length) kids.push("age 6");
  if (/grandparent|grandma|grandpa|nana|papa|multi-?gen/.test(t)) who.push("grandparent multigen");
  if (/couple|partner|spouse|\bwife\b|\bhusband\b|two adults|just us two/.test(t)) who.push("couple");
  if (/\bsolo\b|by myself|just me/.test(t)) who.push("solo");
  return { kids_info: kids.join("; "), who_is_going: who.join(" "), has: !!(kids.length || who.length) };
}

const REFINE_RE = /(cheap|cheaper|budget|fancier|nicer|splurge|upgrade|relax|slower|slow down|more|busy|packed|shorter|fewer|longer|extra day|add a day|accessible|stroller|wheelchair|step-free)/i;
const BOOK_RE = /\b(book|reserve|purchase|buy|checkout|check out)\b/i;
const SHARE_RE = /\b(share|save|send|link|export)\b/i;
const RESET_RE = /(start over|new trip|reset|plan another|different trip)/i;
const COMPARE_RE = /\bor\b|\bvs\.?\b|\bversus\b|\bcompare\b|\bbetween\b/i;

// Pull two candidate destinations out of "A or B" / "compare A and B" / "A vs B".
function readTwoDestinations(text) {
  const m = text.match(/\b([A-Za-z][A-Za-z .'-]{1,30}?)\s+(?:or|vs\.?|versus|and)\s+([A-Za-z][A-Za-z .'-]{1,30})\b/i);
  if (!m) return null;
  const clean = (s) => titlecase(s.trim().split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).slice(0, 3).join(" "));
  const a = clean(m[1]), b = clean(m[2]);
  if (a && b && a.toLowerCase() !== b.toLowerCase()) return [a, b];
  return null;
}

// Merge any slots the latest message revealed into the running intent.
function applySlots(intent, text) {
  const dest = readDestination(text);
  if (dest) intent.destination = dest;
  const days = readDays(text); if (days) intent.days = days;
  const budget = readBudget(text); if (budget) intent.budget = budget;
  const pace = readPace(text); if (pace) intent.pace = pace;
  const weather = readWeather(text); if (weather) intent.weather = weather;

  const party = readParty(text);
  if (party.has) {
    const c = classify({ kids_info: party.kids_info, who_is_going: party.who_is_going });
    intent.party = text.trim();
    intent.persona = c.persona;
    intent.segment = norm(c.life_stage);
    intent.prefs = [...new Set([...(intent.prefs || []), ...c.tuning.prefs])];
    if (!pace && c.tuning.pace) intent.pace = c.tuning.pace;
  }
  return intent;
}

// Build a full day-structured plan from the running intent, reusing the engine.
async function buildPlan(intent) {
  const base = await understand({
    request: intent.request,
    destination: intent.destination,
    days: intent.days,
    budget: intent.budget,
    pace: intent.pace,
    familyProfileId: intent.familyProfileId,
  });
  // inject assistant-derived preferences (persona tuning + stated likes)
  base.prefs = [...new Set([...(base.prefs || []), ...(intent.prefs || [])])];
  base.must_haves = [...new Set([...(base.must_haves || []), ...(intent.must_haves || [])])];
  if (intent.hard_nos?.length) base.hard_nos = [...new Set([...(base.hard_nos || []), ...intent.hard_nos])];

  const options = gatherOptions(base);
  const scored = reason(base, options, intent.weather);
  const plan = compose(base, scored);
  plan.confidence = scored.activities[0]?._conf || "Low";
  plan.recommendation = recommend(base, scored);
  return { base, plan };
}

// Suggestion chips per stage — the assistant always offers a next move.
function suggestions(stage) {
  if (stage === "planned" || stage === "refining")
    return ["Make it cheaper", "More relaxed", "Add a day", "Book it", "Share this plan"];
  if (stage === "booking")
    return ["Plan another trip", "Share this plan"];
  return ["A relaxed weekend in San Diego with a toddler", "Orlando or Miami with kids?", "A budget beach trip with grandparents"];
}

// Deterministic reply text (offline-safe). data carries plan/recommendation.
function draftReply(kind, s, data = {}) {
  const i = s.intent;
  if (kind === "greeting")
    return "Hi! I'm Scout 🦊 — I help families plan trips that actually fit everyone. Where would you like to go, and who's coming along?";
  if (kind === "need_destination")
    return "Love it — let's plan this. Where are you thinking of going?";
  if (kind === "need_party")
    return `Great, ${i.destination}! Who's coming — any little ones, teens, or grandparents along? That helps me pace it right.`;
  if (kind === "planned" || kind === "refined") {
    const r = data.recommendation || {};
    const best = r.best_match;
    const total = data.plan?.estimate?.total;
    const lead = kind === "refined" ? `Updated your plan${data.changed ? ` — ${data.changed}` : ""}.` : `Here's a ${i.days || data.plan?.intent?.days}-day ${i.pace || data.plan?.intent?.pace} plan for ${i.destination}.`;
    const pick = best ? ` Top pick: ${best.title} — ${best.why_fits}` : "";
    const cost = total ? ` Estimated all-in ~$${total}.` : "";
    const conf = data.plan?.confidence ? ` (confidence: ${data.plan.confidence})` : "";
    // Gentle nudge about an assumption the user hasn't pinned down yet.
    let nudge = " Want me to tweak the budget, pace, or length, book it, or share it?";
    if (kind === "planned" && !i.budget) nudge = ` I went with a medium budget — say "cheaper" or "fancier" to change it, or "book it" when you're happy.`;
    else if (kind === "planned" && !i.dates) nudge = ` Pick your dates whenever you're ready — I can also book it or share it as a link.`;
    return `${lead}${pick}${cost}${conf}${nudge}`;
  }
  if (kind === "compared") {
    return `${data.recommendation} Want me to build the full plan for ${data.winner}?`;
  }
  if (kind === "booking")
    return `Done — I've prepped a checkout for your ${i.destination} trip (~$${data.cart?.total}). Flights book through Duffel and payment runs through Stripe in test mode. Open the checkout to confirm travelers and finish: ${data.checkout_url}`;
  if (kind === "shared")
    return `Saved! Here's a shareable link to this plan: ${data.share_url} — anyone with it can view the itinerary.`;
  return "Tell me a bit more and I'll shape the plan around it.";
}

// Optional voice polish — only when a real model is wired up; never invents facts.
async function polish(draft, s) {
  if (!process.env.ANTHROPIC_API_KEY) return draft;
  try {
    const res = await invokeLLM({
      modelKey: "claude_opus_4_8",
      maxTokens: 220,
      system: SCOUT_SYSTEM_PROMPT,
      prompt:
        `Rewrite this assistant message warmly and concisely (2-4 sentences), in Scout's voice. ` +
        `Keep every concrete fact, name, number, and the closing question EXACTLY. Do not add facts.\n\n"${draft}"`,
    });
    if (res.text?.trim() && !res.mocked) return res.text.trim();
  } catch { /* fall back to the draft */ }
  return draft;
}

// --- the single entry point the route calls ---
export async function handleMessage(sessionId, message, ctx = {}) {
  let s = getSession(sessionId);
  if (ctx.familyProfileId) s.intent.familyProfileId = ctx.familyProfileId;

  const text = String(message || "").trim();
  if (!text) {
    const reply = await polish(draftReply("greeting", s), s);
    pushMessage(s, "assistant", reply);
    s.stage = "gathering";
    saveSession(s);
    return respond(s, reply);
  }

  if (RESET_RE.test(text)) {
    s = resetSession(s.id);
    if (ctx.familyProfileId) s.intent.familyProfileId = ctx.familyProfileId;
    pushMessage(s, "user", text);
    const reply = draftReply("need_destination", s);
    pushMessage(s, "assistant", reply);
    s.stage = "gathering";
    saveSession(s);
    return respond(s, reply);
  }

  pushMessage(s, "user", text);
  s.intent.request = [s.intent.request, text].filter(Boolean).join(" ").slice(-400);
  applySlots(s.intent, text);

  let kind, data = {};

  // Share an existing plan as a link.
  if (s.plan && SHARE_RE.test(text) && !REFINE_RE.test(text)) {
    const rec = savePlan(summarizePlan(s.plan), { destination: s.intent.destination, segment: s.intent.segment });
    kind = "shared";
    data = { share_url: `/plan.html?id=${rec.id}`, plan_id: rec.id };
  }
  // Book an existing plan -> build a checkout cart.
  else if (s.plan && BOOK_RE.test(text)) {
    const cart = createCartFromPlan(s.plan, { sessionId: s.id, destination: s.intent.destination });
    s.stage = "booking";
    kind = "booking";
    data = { cart, checkout_url: `/checkout.html?cart=${cart.id}` };
  }
  // Compare two destinations before committing (only pre-plan).
  else if (!s.plan && COMPARE_RE.test(text) && readTwoDestinations(text)) {
    const [a, b] = readTwoDestinations(text);
    const cmp = await compareDestinations(a, b, { familyProfileId: s.intent.familyProfileId });
    s.intent.destination = cmp.options.find((o) => o.family_fit.band === cmp.confidence)?.destination || a;
    // winner = the one the recommendation names
    const winner = cmp.options.reduce((w, o) => (o.family_fit.score > (w?.family_fit.score ?? -1) ? o : w), null);
    s.intent.destination = winner?.destination || a;
    s.stage = "gathering";
    kind = "compared";
    data = { recommendation: cmp.recommendation, winner: s.intent.destination };
  }
  // Already have a plan and the user asked to change it -> refine.
  else if ((s.stage === "planned" || s.stage === "refining") && REFINE_RE.test(text)) {
    const before = { budget: s.intent.budget, pace: s.intent.pace, days: s.intent.days };
    const next = applyFeedback({ ...s.intent, must_haves: s.intent.must_haves || [], hard_nos: s.intent.hard_nos || [] }, text);
    s.intent.budget = next.budget; s.intent.pace = next.pace; s.intent.days = next.days; s.intent.must_haves = next.must_haves;
    const { plan } = await buildPlan(s.intent);
    s.plan = plan;
    s.stage = "refining";
    const chg = [];
    if (before.budget !== s.intent.budget) chg.push(`budget → ${s.intent.budget}`);
    if (before.pace !== s.intent.pace) chg.push(`pace → ${s.intent.pace}`);
    if (before.days !== s.intent.days) chg.push(`${s.intent.days} days`);
    kind = "refined";
    data = { plan, recommendation: plan.recommendation, changed: chg.join(", ") };
  } else if (!s.intent.destination) {
    kind = "need_destination";
    s.stage = "gathering";
  } else {
    // We have a destination — build (or rebuild) the plan.
    const { plan } = await buildPlan(s.intent);
    s.plan = plan;
    s.stage = "planned";
    kind = "planned";
    data = { plan, recommendation: plan.recommendation };
  }

  const reply = await polish(draftReply(kind, s, data), s);
  pushMessage(s, "assistant", reply, { plan: kind === "planned" || kind === "refined" ? summarizePlan(s.plan) : undefined });
  saveSession(s);
  return respond(s, reply, data);
}

// Record an accept/reject on a recommended option straight into the learning loop,
// stamped with the family's segment and the trip's weather/context.
export function recordPlanFeedback(sessionId, { tags = [], accepted, rating } = {}) {
  const s = getSession(sessionId);
  return recordOutcome({
    userId: s.intent.familyProfileId || "anon",
    tags,
    accepted,
    rating,
    segment: s.intent.segment || undefined,
    context: s.intent.weather || undefined,
  });
}

function summarizePlan(plan) {
  if (!plan) return null;
  return {
    destination: plan.destination,
    summary: plan.summary,
    confidence: plan.confidence,
    days: plan.days?.map((d) => ({ day: d.day_number, items: d.items.map((it) => ({ slot: it.slot, title: it.title, reason: it.reason })) })),
    estimate: plan.estimate,
    top_pick: plan.recommendation?.best_match || null,
  };
}

function respond(s, reply, data = {}) {
  return {
    sessionId: s.id,
    reply,
    stage: s.stage,
    intent: s.intent,
    plan: summarizePlan(s.plan),
    recommendation: data.recommendation || s.plan?.recommendation || null,
    checkout_url: data.checkout_url || null,
    share_url: data.share_url || null,
    suggestions: suggestions(s.stage),
  };
}
