"use client";

import { useEffect, useState } from "react";
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

const NearbyStations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    fetchNearbyStations();
  }, []);

  const fetchNearbyStations = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationEnabled(true);

        try {
          const res = await fetch(
            `/api/nearby-stations?lat=${latitude}&lng=${longitude}`
          );
          const data = await res.json();

          if (data.error) {
            setError(data.error);
          } else {
            setStations(data.stations.slice(0, 5)); // Show top 5
          }
        } catch {
          setError("Failed to fetch nearby stations.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError("Location access denied. Enable location for accurate results.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="w-full border-2 border-gray-300 rounded-xl p-6 bg-white mt-8">
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
              {/* Name & Distance */}
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

              {/* Address */}
              <p className="text-xs text-blue-500 mb-3">{station.address}</p>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {/* Call Button */}
                <a
                  href={`tel:${station.phone || "199"}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  <MdLocalPhone className="text-base" />
                  Call
                </a>

                {/* Directions Button */}
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