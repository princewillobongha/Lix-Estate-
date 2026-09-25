const BASE = "https://api.rentcast.io/v1";

export default async function handler(req, res) {
  try {
    const key = process.env.RENTCAST_API_KEY;
    if (!key) return res.status(503).json({ error: "RentCast API key is not configured", listings: [] });

    const q = req.query || {};
    const mode = q.mode === "rent" ? "rent" : "sale";
    const endpoint = mode === "rent" ? "/listings/rental/long-term" : "/listings/sale";
    const params = new URLSearchParams();

    const location = String(q.location || "").trim();
    if (location) {
      const parts = location.split(",").map(x => x.trim());
      if (parts.length >= 2) {
        params.set("city", parts[0]);
        const state = parts[1].split(/\s+/)[0];
        if (/^[A-Za-z]{2}$/.test(state)) params.set("state", state.toUpperCase());
      } else if (/^\d{5}$/.test(location)) {
        params.set("zipCode", location);
      } else {
        params.set("city", location);
      }
    }

    for (const name of ["propertyType","bedrooms","bathrooms","squareFootage","price","daysOld","limit","offset"]) {
      if (q[name]) params.set(name, q[name]);
    }

    params.set("status", "Active");
    if (!params.has("limit")) params.set("limit", "12");

    const response = await fetch(BASE + endpoint + "?" + params.toString(), {
      headers: { "X-Api-Key": key, "Accept": "application/json" }
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data, listings: [] });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      listings: Array.isArray(data) ? data : (data.listings || [])
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load listings", listings: [] });
  }
}
