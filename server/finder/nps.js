// nps.js — live National Park Service data for the Finder "parks" category.
// Docs: https://www.nps.gov/subjects/developer/api-documentation.htm
// Live when NPS_API_KEY is set; returns null on no-key/error so the caller falls
// back to mock. One normalized Place shape: { id, name, category, tags[], price,
// rating, accessible, url, description }.

const TIMEOUT_MS = 9000;
const slug = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

export async function nationalParks({ location = "", limit = 8 } = {}) {
  const key = process.env.NPS_API_KEY;
  if (!key) return null; // not configured → caller uses mock
  try {
    const params = new URLSearchParams({ api_key: key, limit: String(limit) });
    if (location && location !== "your area") params.set("q", location);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let json;
    try {
      const r = await fetch(`https://developer.nps.gov/api/v1/parks?${params.toString()}`, { headers: { Accept: "application/json" }, signal: ac.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      json = await r.json();
    } finally {
      clearTimeout(t);
    }
    const rows = json?.data || [];
    return rows.slice(0, limit).map((p, i) => {
      const fees = p.entranceFees || [];
      const free = !fees.length || fees.every((f) => Number(f.cost) === 0);
      const accessible = Boolean(p.accessibility && (p.accessibility.wheelchairAccess || "").trim());
      const acts = (p.activities || []).slice(0, 4).map((a) => slug(a.name));
      return {
        id: `nps_${p.parkCode || i}`,
        name: p.fullName || p.name,
        category: "parks",
        tags: [...new Set(["park", "outdoor", "national-park", ...(accessible ? ["accessible"] : []), ...acts])],
        price: free ? 0 : Number(fees[0]?.cost) || 0,
        rating: undefined,
        accessible,
        url: p.url,
        description: (p.description || "").slice(0, 200),
        simulated: false,
      };
    });
  } catch (e) {
    console.warn("nationalParks fell back to mock:", e.message);
    return null;
  }
}
