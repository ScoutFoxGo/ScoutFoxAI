// data.js — read access to ScoutFoxGo entities.
//
// This is the bridge to ScoutFoxGo: the AI modules (Mood AI, Scout Scribe,
// Smart Cards) operate on these real entities — trips, trip_days, family
// profiles, scrapbook. It reads the JSON master file (seed.json) for now; point
// it at the live ScoutFoxGo database when that's available — the accessor
// signatures stay the same.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "seed.json");
let cache = null;
function db() {
  if (!cache) cache = JSON.parse(readFileSync(SEED, "utf8"));
  return cache;
}

export const listTrips = () => db().trips;
export const getTrip = (id) => db().trips.find((t) => t.id === id) || null;
export const getTripDays = (tripId) =>
  db().trip_days.filter((d) => d.trip_id === tripId).sort((a, b) => a.day_number - b.day_number);
export const getDestination = (name) =>
  db().destinations.find((d) => d.name?.toLowerCase() === String(name).toLowerCase()) || null;
export const listFamilyProfiles = () => db().family_profiles;
export const getFamilyProfile = (id) => db().family_profiles.find((f) => f.id === id) || null;
export const packingList = () => db().packing_list_items;
export const scrapbookForTrip = (tripName) =>
  db().scrapbook_entries.filter((s) => s.trip_name === tripName);
