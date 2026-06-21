// data.js — access to ScoutFoxGo entities (trips, trip_days, family profiles,
// scrapbook). This is the bridge to ScoutFoxGo.
//
// LIVE DATA: set SCOUTFOXGO_DATA_URL to your live ScoutFoxGo data endpoint
// (returning the same JSON shape as the master file) and the engine runs on real
// trips/families. Call initData() once at startup to load it. With LIVE_ONLY set
// and no URL, this refuses to fall back to sample data.
//
// DEV: with no URL and LIVE_ONLY off, it lazily loads the bundled sample seed so
// the app runs offline.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LIVE_ONLY, requireLive } from "../config.js";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "seed.json");
let cache = null;

// Load real data from the configured live endpoint (preferred) or the sample
// seed (dev only). Safe to call once at boot.
export async function initData() {
  const url = process.env.SCOUTFOXGO_DATA_URL;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SCOUTFOXGO_DATA_URL fetch failed: ${res.status}`);
    cache = await res.json();
    return { source: "live", url };
  }
  requireLive("ScoutFoxGo data (SCOUTFOXGO_DATA_URL)"); // throws in LIVE_ONLY mode
  cache = JSON.parse(readFileSync(SEED, "utf8"));
  return { source: "sample-seed" };
}

function db() {
  if (cache) return cache;
  // Lazy dev fallback if initData() wasn't called.
  requireLive("ScoutFoxGo data (SCOUTFOXGO_DATA_URL)");
  cache = JSON.parse(readFileSync(SEED, "utf8"));
  return cache;
}

export const listTrips = () => db().trips || [];
export const getTrip = (id) => (db().trips || []).find((t) => t.id === id) || null;
export const getTripDays = (tripId) =>
  (db().trip_days || []).filter((d) => d.trip_id === tripId).sort((a, b) => a.day_number - b.day_number);
export const getDestination = (name) =>
  (db().destinations || []).find((d) => d.name?.toLowerCase() === String(name).toLowerCase()) || null;
export const listFamilyProfiles = () => db().family_profiles || [];
export const getFamilyProfile = (id) => (db().family_profiles || []).find((f) => f.id === id) || null;
export const packingList = () => db().packing_list_items || [];
export const scrapbookForTrip = (tripName) =>
  (db().scrapbook_entries || []).filter((s) => s.trip_name === tripName);
