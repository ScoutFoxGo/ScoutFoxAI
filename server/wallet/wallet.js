// wallet.js — Scout Wallet™: membership-aware deals.
//
// Tracks a user's memberships/passes and applies them to inventory options —
// flagging what's included (free) or discounted, and prioritizing those. Fully
// in-house and deterministic. This is the "deals in Scout" layer.

import { load, save } from "../lms/jsondb.js";

const FILE = "wallet";

// Known programs: percentage discounts by option type, and passes that make
// matching activities free (included).
const PROGRAMS = {
  AAA: { label: "AAA", discount: { hotel: 0.1, activity: 0.1, cruise: 0.05 } },
  AARP: { label: "AARP", discount: { hotel: 0.1, cruise: 0.05 } },
  military: { label: "Military", discount: { hotel: 0.15, activity: 0.1, flight: 0.05 } },
  teacher: { label: "Teacher", discount: { activity: 0.1 } },
  zoo_pass: { label: "Zoo membership", includes_tags: ["zoo", "animals", "aquarium"] },
  museum_pass: { label: "Museum membership", includes_tags: ["museum", "educational", "cultural"] },
  theme_park_pass: { label: "Theme park pass", includes_tags: ["theme park", "thrill"] },
  national_park_pass: { label: "National Park pass", includes_tags: ["park", "national-park", "outdoors"] },
};

export function listPrograms() {
  return Object.entries(PROGRAMS).map(([key, p]) => ({ key, label: p.label }));
}

export function getWallet(userId) {
  const db = load(FILE, {});
  return db[userId] || { userId, memberships: [] };
}
export function setMemberships(userId, memberships) {
  const valid = (memberships || []).filter((m) => PROGRAMS[m]);
  const db = load(FILE, {});
  db[userId] = { userId, memberships: valid };
  save(FILE, db);
  return db[userId];
}

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

// Annotate one option with the best applicable membership benefit.
function applyOne(option, memberships) {
  const tags = (option.tags || []).map(norm);
  // 1. Included (free) via a pass that matches the option's tags.
  for (const m of memberships) {
    const p = PROGRAMS[m];
    if (p?.includes_tags && p.includes_tags.some((t) => tags.includes(norm(t)))) {
      return { ...option, deal: { included: true, applied: p.label, effective_price: 0, saved: option.price } };
    }
  }
  // 2. Otherwise the best percentage discount for this option's type.
  let best = null;
  for (const m of memberships) {
    const pct = PROGRAMS[m]?.discount?.[option.type];
    if (pct && (!best || pct > best.pct)) best = { pct, label: PROGRAMS[m].label };
  }
  if (best && option.price > 0) {
    const eff = Math.round(option.price * (1 - best.pct));
    return { ...option, deal: { discount_pct: Math.round(best.pct * 100), applied: best.label, effective_price: eff, saved: option.price - eff } };
  }
  return { ...option, deal: null };
}

// Apply the user's wallet to a list of options; included/discounted float to top.
export function applyWallet(userId, options) {
  const { memberships } = getWallet(userId);
  const out = (options || []).map((o) => applyOne(o, memberships));
  out.sort((a, b) => {
    const av = a.deal?.included ? 2 : a.deal ? 1 : 0;
    const bv = b.deal?.included ? 2 : b.deal ? 1 : 0;
    return bv - av;
  });
  return { memberships, options: out };
}
