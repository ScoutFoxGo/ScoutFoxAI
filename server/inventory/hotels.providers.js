// hotels.providers.js — live hotel adapters for the affiliate programs you have:
// Booking.com (Demand API) and Expedia Group (EPS Rapid).
//
// Each returns a normalized Option[] when its key is set and the call succeeds,
// or null when not configured / on any error (the caller then falls back to mock,
// so the app never breaks). AUTH is implemented for real (Expedia's SHA-512 Rapid
// signature; Booking's bearer + affiliate header). Every call has a timeout.
//
// ⚠️ VERIFY BEFORE TRUSTING LIVE RESULTS: both APIs need a destination→ID step
// (Booking: a `ufi`/coordinates via /common/locations; Expedia: a `region_id`/
// `property_id[]` via the Geography API) and exact response field paths can differ
// by account/version. Those spots are marked "VERIFY". Until confirmed, a missing
// region/parse error simply falls back to mock — no crash.

import { createHash } from "node:crypto";

const TIMEOUT_MS = 9000;
const mk = (o) => ({ currency: "USD", bookable: true, tags: ["hotel"], ...o });

async function fetchJSON(url, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: ac.signal });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 160)}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}

// Most hotel APIs require checkin/checkout — default a near-future stay if absent.
function stayDates(check_in, check_out, nights = 2) {
  const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return { checkin: check_in || d(14), checkout: check_out || d(14 + Math.max(1, nights)) };
}

// --- Booking.com Demand API (affiliate) -----------------------------------------
// Docs: https://developers.booking.com  ·  needs BOOKING_API_KEY (+ BOOKING_AFFILIATE_ID)
export async function bookingHotels({ destination, check_in, check_out, guests = 2, nights = 2 } = {}) {
  const key = process.env.BOOKING_API_KEY;
  if (!key) return null; // not configured → caller falls back to mock
  const { checkin, checkout } = stayDates(check_in, check_out, nights);
  try {
    const body = {
      booker: { country: "us", platform: "desktop" },
      checkin,
      checkout,
      guests: { number_of_adults: guests, number_of_rooms: 1 },
      // VERIFY: Demand API needs a resolved destination — a `city` (ufi) or
      // `coordinates:{latitude,longitude}`, not a free-text name. Resolve via
      // POST /3.1/common/locations first. Sent best-effort; falls back on error.
      destination,
    };
    const json = await fetchJSON("https://demandapi.booking.com/3.1/accommodations/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.BOOKING_AFFILIATE_ID ? { "X-Affiliate-Id": String(process.env.BOOKING_AFFILIATE_ID) } : {}),
      },
      body: JSON.stringify(body),
    });
    const rows = json?.data || json?.results || [];
    return rows.slice(0, 8).map((h, i) =>
      mk({
        id: `bkg_${i}_${destination}`,
        type: "hotel",
        title: h.name || h.hotel_name || `Hotel ${i + 1} — ${destination}`,
        supplier: "Booking.com",
        price: Number(h.price?.amount ?? h.min_total_price ?? h.price ?? 0) || 0, // VERIFY field path
        currency: h.price?.currency || "USD",
        location: destination,
        rating: h.review_score != null ? Number(h.review_score) / 2 : undefined, // 10-scale → 5
      })
    );
  } catch (e) {
    console.warn("bookingHotels fell back to mock:", e.message);
    return null;
  }
}

// --- Expedia Group / EPS Rapid (affiliate) --------------------------------------
// Docs: https://developer.expediagroup.com/products/rapid  ·  needs EXPEDIA_API_KEY + EXPEDIA_SHARED_SECRET
function rapidAuthHeader(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const signature = createHash("sha512").update(apiKey + secret + ts).digest("hex");
  return `EAN APIKey=${apiKey},Signature=${signature},timestamp=${ts}`;
}

export async function expediaHotels({ destination, check_in, check_out, guests = 2, nights = 2, region_id } = {}) {
  const key = process.env.EXPEDIA_API_KEY;
  const secret = process.env.EXPEDIA_SHARED_SECRET;
  if (!key || !secret) return null;
  const region = region_id || process.env.EXPEDIA_DEFAULT_REGION_ID;
  // VERIFY: Rapid availability requires region_id or property_id[]; resolve the
  // destination via the Geography API. Without one we can't query — fall back.
  if (!region) {
    console.warn("expediaHotels: no region_id resolved for", destination, "— falling back to mock");
    return null;
  }
  const { checkin, checkout } = stayDates(check_in, check_out, nights);
  try {
    const params = new URLSearchParams({
      checkin,
      checkout,
      currency: "USD",
      language: "en-US",
      country_code: "US",
      sales_channel: "website",
      sales_environment: "hotel_only",
      region_id: String(region),
    });
    params.append("occupancy", String(guests));
    const json = await fetchJSON(`https://api.ean.com/v3/properties/availability?${params.toString()}`, {
      headers: { Authorization: rapidAuthHeader(key, secret), Accept: "application/json", "User-Agent": "ScoutFoxAI", "Customer-Ip": "1.1.1.1" },
    });
    const rows = Array.isArray(json) ? json : json?.properties || [];
    return rows.slice(0, 8).map((p, i) =>
      mk({
        id: `exp_${i}_${destination}`,
        type: "hotel",
        title: p.property_name || p.name || `Hotel ${i + 1} — ${destination}`,
        supplier: "Expedia",
        // VERIFY response shape: Rapid nests price under rooms[].rates[].occupancy_pricing.
        price: Number(p.price?.total ?? p.lead_rate?.amount ?? 0) || 0,
        location: destination,
        rating: p.star_rating != null ? Number(p.star_rating) : undefined,
      })
    );
  } catch (e) {
    console.warn("expediaHotels fell back to mock:", e.message);
    return null;
  }
}

// Gather from whichever hotel affiliates are configured (skips unconfigured/errored).
export async function liveHotels(params) {
  const results = await Promise.all([bookingHotels(params), expediaHotels(params)]);
  return results.filter(Array.isArray).flat();
}
