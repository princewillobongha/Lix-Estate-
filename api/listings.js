const BASE = "https://realtor.realtyapi.io/search/bylocation";

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

function uniquePhotos(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    const url = photoUrl(entry);
    if (!url || isFloorPlanPhoto(entry) || !/^https?:\/\//i.test(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  }).map(photoUrl);
}

function normalizeListing(item, mode) {
  const address = item.address && typeof item.address === "object" ? item.address : {};
  const mediaPhotos = item.media && Array.isArray(item.media.photosList) ? item.media.photosList : [];
  const rawPhotos = [
    ...(Array.isArray(item.photos) ? item.photos : []),
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.gallery) ? item.gallery : []),
    ...mediaPhotos
  ];
  const photos = uniquePhotos([
    item.primary_photo, item.primaryPhoto, item.photo, item.image, item.image_url,
    ...rawPhotos
  ]);
  const primaryPhoto = photos[0] || "";
  const city = firstText(address.city, item.city);
  const state = firstText(address.state_code, address.state, item.state);
  const street = firstText(address.line, address.street, address.street_address, item.street_address);
  const postal = firstText(address.postal_code, address.zip, item.zip, item.postal_code);
  const formattedAddress = firstText(
    [street, city, state, postal].filter(Boolean).join(", "),
    item.formattedAddress,
    typeof item.address === "string" ? item.address : ""
  );
  const sourceTitle = firstText(item.description_title, item.title);
  const title = /floor[\s_-]*plan|blueprint|site[\s_-]*plan/i.test(sourceTitle)
    ? firstText(street, city ? city + " property" : "EstateLux Property")
    : firstText(sourceTitle, street, city ? city + " property" : "EstateLux Property");

  return {
    id: String(firstText(item.listing_id, item.id, item.property_id, item.href)),
    propertyId: String(firstText(item.property_id, item.propertyId)),
    listingId: String(firstText(item.listing_id, item.listingId, item.id)),
    title,
    mode,
    price: Number(firstText(item.list_price, item.price, item.listPrice, 0)) || 0,
    bedrooms: item.beds ?? item.bedrooms ?? null,
    bathrooms: item.baths ?? item.bathrooms ?? null,
    squareFootage: item.sqft ?? item.square_feet ?? item.squareFootage ?? 0,
    propertyType: firstText(item.prop_type, item.property_type, item.propertyType, "Property"),
    listingType: mode === "rent" ? "RENT" : "FOR SALE",
    photo: primaryPhoto,
    photos,
    city,
    state,
    address: formattedAddress,
    formattedAddress,
    zip: postal,
    latitude: address.coordinate?.lat ?? address.latitude ?? item.latitude ?? item.lat ?? null,
    longitude: address.coordinate?.lon ?? address.longitude ?? item.longitude ?? item.lng ?? null,
    description: firstText(item.description, item.public_remarks),
    href: firstText(item.href, item.url, item.listing_url),
    status: firstText(item.status),
    listDate: firstText(item.list_date, item.listDate),
    source: firstText(item.source, "Realtor.com")
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed", listings: [] });
  }

  const key = process.env.REALTYAPI_KEY;
  if (!key) {
    return res.status(503).json({ error: "RealtyAPI key is not configured for this deployment.", listings: [] });
  }

  const q = req.query || {};
  const mode = q.mode === "rent" ? "rent" : "sale";
  const location = String(q.location || "Austin, TX").trim();
  if (!location) return res.status(400).json({ error: "Please provide a U.S. city or ZIP code.", listings: [] });

  const params = new URLSearchParams({
    location,
    searchType: mode === "rent" ? "For_Rent" : "For_Sale",
    resultCount: String(Math.min(50, Math.max(1, Number(q.limit) || 24))),
    page: String(Math.max(1, Number(q.page) || 1)),
    sortOrder: "Recommended",
    hasPhotos: "true"
  });

  const propertyType = String(q.propertyType || "").trim();
  if (propertyType) {
    const aliases = {
      "Single Family": "House",
      "Townhouse": "Townhome",
      "Manufactured": "Mobile",
      "Multi-Family": "Multi_Family",
      "Apartment": "Condo"
    };
    params.set("propertyType", aliases[propertyType] || propertyType.replace(/\s+/g, "_"));
  }

  const beds = String(q.bedrooms || "").trim().replace("+", "");
  if (beds && /^\d+$/.test(beds)) params.set("bedsRange", "min:" + beds);

  const maxPrice = String(q.price || "").trim();
  if (maxPrice && /^\d+$/.test(maxPrice)) params.set("priceRange", "max:" + maxPrice);

  try {
    const response = await fetch(BASE + "?" + params.toString(), {
      method: "GET",
      headers: { "x-realtyapi-key": key, "Accept": "application/json" }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("RealtyAPI request failed:", response.status);
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502)
        .json({ error: "The live property provider returned an error. Please try again shortly.", listings: [] });
    }

    const raw = Array.isArray(data)
      ? data
      : (data.searchResults || data.results || data.listings || data.properties || data.data?.searchResults || data.data?.results || data.data || data.hits || []);
    const listings = Array.isArray(raw)
      ? raw.map(item => normalizeListing(item, mode)).filter(item => item.price > 0 && item.photo)
      : [];

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      listings,
      source: "RealtyAPI / Realtor.com",
      total: Number(data.total ?? data.totalCount ?? data.data?.total ?? data.data?.totalCount ?? listings.length) || listings.length,
      page: Number(data.page ?? data.data?.page ?? q.page ?? 1),
      nextPage: Boolean(data.nextPage ?? data.data?.nextPage)
    });
  } catch (error) {
    console.error("RealtyAPI connection error:", error?.message || error);
    return res.status(502).json({ error: "Unable to reach the live property provider right now.", listings: [] });
  }
}
