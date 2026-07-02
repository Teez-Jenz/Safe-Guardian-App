import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const radius = 5000; // 5km radius

  // Overpass query to find police stations nearby
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="police"](around:${radius},${lat},${lng});
      way["amenity"="police"](around:${radius},${lat},${lng});
      relation["amenity"="police"](around:${radius},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  const data = await response.json();

  const stations = data.elements
    .filter((el: any) => el.tags)
    .map((el: any) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;

      return {
        name: el.tags?.name || "Police Station",
        address:
          [el.tags?.["addr:street"], el.tags?.["addr:city"]]
            .filter(Boolean)
            .join(", ") || "Address unavailable",
        phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
        distance:
          elLat && elLng
            ? getDistanceKm(parseFloat(lat), parseFloat(lng), elLat, elLng)
            : null,
        lat: elLat,
        lng: elLng,
      };
    })
    .filter((s: any) => s.lat && s.lng)
    .sort((a: any, b: any) => (a.distance ?? 99) - (b.distance ?? 99))
    .slice(0, 5);

  return NextResponse.json({ stations });
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return parseFloat(
    (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1),
  );
}
