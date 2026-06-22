// openweather.js — live weather for a destination, used to tune planning.
// Docs: https://openweathermap.org/api  ·  live when OPENWEATHER_API_KEY is set.
//
// Returns { place, token, temp_c, description, simulated } or null (no key/error).
// `token` is a coarse bucket (sunny/rainy/hot/cold/cloudy) the Decision Layer's
// weatherFit() already understands, so live weather flows straight into ranking
// (indoor on a wet day, shaded on a hot one) and Companion alerts.

const TIMEOUT_MS = 9000;

async function fetchJSON(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function bucket(main = "", tempC) {
  const m = String(main).toLowerCase();
  if (/rain|drizzle|thunderstorm/.test(m)) return "rainy";
  if (/snow/.test(m)) return "cold";
  if (tempC >= 30) return "hot";
  if (tempC <= 5) return "cold";
  if (/cloud/.test(m)) return "cloudy";
  return "sunny";
}

export async function getWeather(place) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key || !place || place === "your destination") return null;
  try {
    const geo = await fetchJSON(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(place)}&limit=1&appid=${key}`);
    if (!Array.isArray(geo) || !geo.length) return null;
    const { lat, lon } = geo[0];
    const w = await fetchJSON(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`);
    const tempC = Math.round(w?.main?.temp);
    return { place, token: bucket(w?.weather?.[0]?.main, tempC), temp_c: tempC, description: w?.weather?.[0]?.description, simulated: false };
  } catch (e) {
    console.warn("getWeather fell back:", e.message);
    return null;
  }
}
