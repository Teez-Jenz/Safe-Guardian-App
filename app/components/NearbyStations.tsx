"use client";

import { useCallback, useEffect, useState } from "react";
import { TbNavigation } from "react-icons/tb";
import { MdLocalPhone } from "react-icons/md";
import { GrLocation } from "react-icons/gr";

interface Station {
  name: string;
  address: string;
  distance: number | null;
  lat: number;
  lng: number;
  phone: string | null;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    "addr:housenumber"?: string;
    "addr:street"?: string;
    "addr:city"?: string;
    "addr:state"?: string;
    "name:en"?: string;
    operator?: string;
    phone?: string;
    "contact:phone"?: string;
    "contact:mobile"?: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Haversine distance formula
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
    (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
  );
}

// Try multiple Overpass endpoints in case one is blocked
const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // ✅ works
  "https://overpass.kumi.systems/api/interpreter", // fallback
];

const NearbyStations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);

  const queryOverpass = useCallback(async (
    lat: number,
    lng: number,
    endpoint: string,
  ): Promise<Station[]> => {
    const query = `
     [out:json][timeout:25];
     (
       node["amenity"="police"](around:5000,${lat},${lng});
       way["amenity"="police"](around:5000,${lat},${lng});
     );
     out center;
   `;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = (await response.json()) as OverpassResponse;

    return data.elements
      .filter((el) => el.tags)
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        return {
          name: el.tags?.name || "Police Station",
          address:
            [
              el.tags?.["addr:housenumber"],
              el.tags?.["addr:street"],
              el.tags?.["addr:city"] || el.tags?.["addr:state"],
            ]
              .filter(Boolean)
              .join(", ") ||
            el.tags?.["name:en"] ||
            el.tags?.operator ||
            (elLat && elLng ? `${elLat.toFixed(4)}, ${elLng.toFixed(4)}` : "Address unavailable"),
          phone:
            el.tags?.phone ||
            el.tags?.["contact:phone"] ||
            el.tags?.["contact:mobile"] ||
            null,
          distance:
            elLat && elLng ? getDistanceKm(lat, lng, elLat, elLng) : null,
          lat: elLat || 0,
          lng: elLng || 0,
        };
      })
      .filter((s) => s.lat && s.lng)
      .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
      .slice(0, 5);
  }, []);

  const fetchNearbyStations = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError("");
    setStations([]);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationEnabled(true);

        let success = false;

        for (const endpoint of OVERPASS_ENDPOINTS) {
          try {
            console.log("Trying endpoint:", endpoint);
            const results = await queryOverpass(latitude, longitude, endpoint);
            setStations(results);
            success = true;

            if (results.length === 0) {
              setError(
                "No police stations found within 5km of your location."
              );
            }

            break; // Stop trying endpoints once one works
          } catch (err: unknown) {
            console.warn(`Endpoint failed (${endpoint}):`, err instanceof Error ? err.message : String(err));
          }
        }

        if (!success) {
          setError(
            "Unable to reach map services. Please check your internet connection."
          );
        }

        setLoading(false);
      },
      () => {
        setLoading(false);
        setError(
          "Location access denied. Enable location for accurate results."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [queryOverpass]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNearbyStations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNearbyStations]);

  return (
    <div className="w-full border-2 border-gray-300 rounded-lg p-6 bg-white mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <TbNavigation className="text-gray-700 text-lg" />
          <h2 className="text-black font-semibold text-base">
            Nearby Police Stations
          </h2>
        </div>
        <button
          onClick={fetchNearbyStations}
          className="text-xs text-red-600 underline hover:text-red-800"
        >
          Refresh
        </button>
      </div>

      {/* Subtitle */}
      {!locationEnabled && !loading && (
        <p className="text-sm text-red-500 mb-4">
          Enable location for accurate results
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full h-24 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}

      {/* Station List */}
      {!loading && stations.length > 0 && (
        <div className="flex flex-col gap-3 mt-4">
          {stations.map((station, index) => (
            <div
              key={index}
              className="w-full bg-blue-50 border border-blue-100 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {station.name}
                </h3>
                {station.distance !== null && (
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {station.distance} km
                  </span>
                )}
              </div>

              <p className="text-xs text-blue-500 mb-3">{station.address}</p>

              <div className="flex gap-2">
                <a
                  href={`tel:${station.phone || "199"}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  <MdLocalPhone className="text-base" />
                  Call
                </a>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium py-2 rounded-lg border border-gray-300 transition"
                >
                  <GrLocation className="text-base" />
                  Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && stations.length === 0 && (
        <p className="text-sm text-gray-400 mt-4">
          No nearby police stations found.
        </p>
      )}
    </div>
  );
};

export default NearbyStations;