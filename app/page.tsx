"use client";

import { useEffect, useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { GrLocation } from "react-icons/gr";
import { MdCancel } from "react-icons/md";
import { useSafety } from "./context/SafetyContext";

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // ✅ works
  "https://overpass.kumi.systems/api/interpreter", // fallback
];

interface OverpassElement {
  tags?: {
    name?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    "addr:suburb"?: string;
    "addr:city"?: string;
    highway?: string;
    place?: string;
  };
}

const getAddress = async (lat: number, lon: number): Promise<string> => {
  const query = `
    [out:json][timeout:15];
    (
      way(around:150, ${lat}, ${lon})["highway"]["name"];
      node(around:150, ${lat}, ${lon})["addr:street"];
      node(around:300, ${lat}, ${lon})["place"];
    );
    out tags;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) continue;

      const data = await response.json() as { elements?: OverpassElement[] };
      if (!data || !data.elements || data.elements.length === 0) continue;

      const elements = data.elements.filter((el): el is OverpassElement & { tags: NonNullable<OverpassElement["tags"]> } => !!el.tags);
      
      const withHouse = elements.find((el) => el.tags["addr:street"] && el.tags["addr:housenumber"]);
      if (withHouse) {
        const parts = [
          withHouse.tags["addr:housenumber"],
          withHouse.tags["addr:street"],
          withHouse.tags["addr:suburb"] || withHouse.tags["addr:city"]
        ].filter(Boolean);
        return parts.join(", ");
      }

      const withStreet = elements.find((el) => el.tags["addr:street"]);
      if (withStreet) {
        const parts = [
          withStreet.tags["addr:street"],
          withStreet.tags["addr:suburb"] || withStreet.tags["addr:city"]
        ].filter(Boolean);
        return parts.join(", ");
      }

      const withHighway = elements.find((el) => el.tags.highway && el.tags.name);
      if (withHighway && withHighway.tags.name) {
        return withHighway.tags.name;
      }

      const withPlace = elements.find((el) => el.tags.place && el.tags.name);
      if (withPlace && withPlace.tags.name) {
        return withPlace.tags.name;
      }
    } catch (err) {
      console.warn("Failed to fetch address from Overpass endpoint:", endpoint, err);
    }
  }

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

const fetchLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const address = await getAddress(latitude, longitude);
        resolve({ latitude, longitude, accuracy, address });
      },
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
};

const Page = () => {
  const [userName, setUserName] = useState("");
  const { sosActive, startSos, stopSos } = useSafety();
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const response = await fetch("/api/session");
      if (!response.ok) return;
      const data = await response.json();
      setUserName(data.session?.name || "");
    };
    getUser();
  }, []);

  // Sync current location state when SOS mounts/activates
  useEffect(() => {
    if (sosActive && !location) {
      const timer = setTimeout(() => {
        setIsFetchingLocation(true);
        fetchLocation()
          .then((loc) => {
            setLocation(loc);
          })
          .catch((err: unknown) => {
            setLocationError(err instanceof Error ? err.message : "Unable to retrieve location.");
          })
          .finally(() => {
            setIsFetchingLocation(false);
          });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sosActive, location]);

  const handleSosClick = async () => {
    if (sosActive) return;

    setIsFetchingLocation(true);
    setLocationError("");

    try {
      const loc = await fetchLocation();
      setLocation(loc);
      setIsSending(true);
      await startSos(loc);
      setAlertMessage("SOS alert sent to your trusted contacts.");
    } catch (err: unknown) {
      setLocationError(
        err instanceof Error ? err.message : "Unable to retrieve location."
      );
    } finally {
      setIsFetchingLocation(false);
      setIsSending(false);
    }
  };

  const handleCancel = async () => {
    await stopSos();
    setLocation(null);
    setAlertMessage("");
    setLocationError("");
  };

  return (
    <>
    <main className="w-full h-full p-8 bg-gray-50">

      {/* SOS Active Banner */}
      {sosActive && (
        <div className="w-full mb-6 bg-red-600 text-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-lg animate-pulse">
          <HiOutlineExclamationCircle className="text-2xl shrink-0" />
          <div>
            <p className="font-bold text-lg">🚨 SOS IS ACTIVE</p>
            <p className="text-sm text-red-100">
              {isSending
                ? "Sending alert to your trusted contacts..."
                : alertMessage}
            </p>
          </div>
        </div>
      )}

      <section className="w-full h-full border-2 border-gray-300 rounded-lg
       p-8 bg-white">
        <h1 className="text-2xl text-black font-semibold">
          Welcome, {userName || "User"}
        </h1>
        <p className="text-gray-500 pt-3">
          Press the button below to immediately alert your trusted contacts.
        </p>

        {/* SOS Button */}
        <div className="w-full mt-8 flex flex-col items-center justify-center py-10 gap-6">
          <button
            onClick={handleSosClick}
            disabled={isFetchingLocation || sosActive}
            className={`
              w-50 h-50 rounded-full flex items-center justify-center cursor-pointer
              transform transition duration-300
              ${sosActive
                ? "bg-red-600 scale-110 shadow-[0_0_40px_10px_rgba(220,38,38,0.6)] animate-pulse"
                : "bg-red-600 hover:scale-110 shadow-lg"
              }
              disabled:cursor-not-allowed
            `}
          >
            <div className="flex flex-col items-center justify-center gap-2 p-10">
              <HiOutlineExclamationCircle className="text-white text-3xl" />
              <span className="text-3xl font-bold text-white">SOS</span>
              <span className="text-sm text-white">
                {isFetchingLocation ? "Locating..." : sosActive ? "Active" : "Tap to Alert"}
              </span>
            </div>
          </button>

          {/* Cancel Button */}
          {sosActive && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded-2xl font-semibold transition duration-200 shadow-md"
            >
              <MdCancel className="text-xl" />
              Cancel SOS Alert
            </button>
          )}
        </div>

        {/* Location Box */}
        <div
          className={`w-full border-2 rounded-2xl flex flex-col gap-2 p-6 transition-all duration-300 ${
            sosActive ? "bg-red-50 border-red-300" : "bg-gray-200 border-gray-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <GrLocation className={`text-xl ${sosActive ? "text-red-500" : "text-gray-500"}`} />
            <h2 className="font-medium text-black">Current Location</h2>
          </div>

          {locationError && (
            <p className="text-sm text-red-600 mt-1">{locationError}</p>
          )}

          {isFetchingLocation && (
            <p className="text-sm text-gray-500 mt-1">Fetching your location...</p>
          )}

          {location && !isFetchingLocation && (
            <div className="mt-1 text-sm text-gray-700 space-y-1">
              {location.address && (
                <p className="font-medium text-gray-800">{location.address}</p>
              )}
              <p className="text-gray-500">
                Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
              </p>
              <p className="text-gray-400 text-xs">Accuracy: ±{location.accuracy.toFixed(0)}m</p>
              <a
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-red-600 underline text-xs"
              >
                View on Google Maps →
              </a>
            </div>
          )}

          {!location && !isFetchingLocation && !locationError && (
            <p className="text-sm text-gray-400 mt-1">
              Location will appear here once SOS is activated.
            </p>
          )}
        </div>
      </section>

      <section className="w-full h-full border-2 border-gray-300 rounded-xl p-8 bg-white mt-8">
        <h2 className="text-black font-semibold">Quick Info</h2>
        <ul className="list-disc list-inside text-gray-600 mt-4">
          <li>Your location is being tracked when SOS is active</li>
          <li>Keep your trusted contacts updated with your current information.</li>
          <li>Regularly review and update your emergency contacts list.</li>
        </ul>
      </section>
    </main>
    </>
  );
};

export default Page;
