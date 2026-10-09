const BASE = "https://realtor.realtyapi.io/details/byid";

function firstText(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "") ?? "";
}

function photoUrl(photo) {
  if (typeof photo === "string") return photo.trim().replace(/^http:\/\//i, "https://");
  if (!photo || typeof photo !== "object") return "";
  return firstText(photo.highRes, photo.full_size_url, photo.url, photo.href, photo.src, photo.image_url, photo.midRes, photo.lowRes);
}

function isFloorPlanPhoto(photo) {
  const url = photoUrl(photo);
  const hints = typeof photo === "object" && photo
    ? [url, photo.caption, photo.description, photo.type, photo.category, photo.label, photo.name, photo.image_type, photo.media_type, photo.title].join(" ")
    : url;
  return /floor[\s_-]*plan|blueprint|site[\s_-]*plan|plot[\s_-]*plan|\bplat map\b|\bmap image\b/i.test(hints);
}

function collectPhotos(record) {
  const mediaPhotos = Array.isArray(record?.media?.photosList) ? record.media.photosList : [];
  const candidates = [
    ...(Array.isArray(record?.photos) ? record.photos : []),
    ...(Array.isArray(record?.images) ? record.images : []),
    ...(Array.isArray(record?.gallery) ? record.gallery : []),
    ...mediaPhotos,
    record?.primary_photo,
    record?.primaryPhoto,
    record?.photo,
    record?.image,
    record?.image_url
  ];
  const seen = new Set();
  return candidates.filter(entry => {
    const url = photoUrl(entry);
    if (!url || isFloorPlanPhoto(entry) || !/^https?:\/\//i.test(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  }).map(photoUrl);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.REALTYAPI_KEY;
  if (!key) return res.status(503).json({ error: "RealtyAPI key is not configured." });

  const q = req.query || {};
  const propertyId = String(q.propertyId || q.property_id || "").trim();
  const listingId = String(q.listingId || q.listing_id || "").trim();
  const mode = q.mode === "rent" ? "rent" : "sale";
  if (!/^\d+$/.test(propertyId)) {
    return res.status(400).json({ error: "A valid property ID is required." });
  }

  const params = new URLSearchParams({ property_id: propertyId });
  if (listingId && !listingId.startsWith("demo-")) params.set("listing_id", listingId);

  try {
    const response = await fetch(BASE + "?" + params.toString(), {
      headers: { "x-realtyapi-key": key, "Accept": "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("RealtyAPI property detail request failed:", response.status);
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502)
        .json({ error: "Could not load the full property details." });
    }

    const record = payload.property || payload.listing || payload.result || payload.details ||
      payload.data?.property || payload.data?.listing || payload.data?.result || payload.data || payload;
    const addressObj = record.address && typeof record.address === "object" ? record.address : {};
    const photos = collectPhotos(record);
    const city = firstText(addressObj.city, record.city);
    const state = firstText(addressObj.state_code, addressObj.state, record.state);
    const street = firstText(addressObj.line, addressObj.street, addressObj.street_address, record.street_address);
    const postal = firstText(addressObj.postal_code, addressObj.zip, record.zip, record.postal_code);
    const formattedAddress = firstText(
      [street, city, state, postal].filter(Boolean).join(", "),
      record.formattedAddress,
      typeof record.address === "string" ? record.address : ""
    );
    const rawTitle = firstText(record.description_title, record.title);
    const title = /floor[\s_-]*plan|blueprint|site[\s_-]*plan/i.test(rawTitle)
      ? firstText(street, city ? city + " property" : "EstateLux Property")
      : firstText(rawTitle, street, city ? city + " property" : "EstateLux Property");

    const listing = {
      id: String(firstText(record.listing_id, record.id, listingId, propertyId)),
      listingId: String(firstText(record.listing_id, listingId, record.id)),
      propertyId,
      mode,
      title,
      price: Number(firstText(record.list_price, record.price, record.listPrice, 0)) || 0,
      bedrooms: record.beds ?? record.bedrooms ?? null,
      bathrooms: record.baths ?? record.bathrooms ?? null,
      squareFootage: record.sqft ?? record.square_feet ?? record.squareFootage ?? 0,
      propertyType: firstText(record.prop_type, record.property_type, record.propertyType, "Property"),
      listingType: mode === "rent" ? "RENT" : "FOR SALE",
      photo: photos[0] || "",
      photos,
      city,
      state,
      address: formattedAddress,
      formattedAddress,
      zip: postal,
      latitude: addressObj.coordinate?.lat ?? addressObj.latitude ?? record.latitude ?? record.lat ?? null,
      longitude: addressObj.coordinate?.lon ?? addressObj.longitude ?? record.longitude ?? record.lng ?? null,
      description: firstText(record.description, record.public_remarks),
      href: firstText(record.href, record.url, record.listing_url),
      status: firstText(record.status),
      source: "RealtyAPI / Realtor.com"
    };

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ listing, source: "RealtyAPI / Realtor.com" });
  } catch (error) {
    console.error("RealtyAPI property detail connection error:", error?.message || error);
    return res.status(502).json({ error: "Unable to load the full property details right now." });
  }
}
