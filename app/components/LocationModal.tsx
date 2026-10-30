"use client";

import { useState } from "react";
import { FiEdit3, FiSearch, FiCheck, FiX, FiMapPin, FiNavigation } from "react-icons/fi";
import { searchAddress, saveManualLocation, clearManualLocation, LocationResult } from "@/lib/geolocation";

interface LocationModalProps {
  currentLocation: LocationResult | null;
  onLocationUpdated: (newLoc: LocationResult) => void;
  onClose: () => void;
}

export default function LocationModal({
  currentLocation,
  onLocationUpdated,
  onClose,
}: LocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    displayName: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [customAddress, setCustomAddress] = useState(currentLocation?.address || "");
  const [customLat, setCustomLat] = useState(currentLocation?.latitude ? String(currentLocation.latitude) : "");
  const [customLon, setCustomLon] = useState(currentLocation?.longitude ? String(currentLocation.longitude) : "");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (item: { displayName: string; latitude: number; longitude: number }) => {
    saveManualLocation({
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.displayName,
    });

    const newLoc: LocationResult = {
      latitude: item.latitude,
      longitude: item.longitude,
      accuracy: 10,
      address: item.displayName,
      source: "manual",
      timestamp: Date.now(),
    };

    onLocationUpdated(newLoc);
    onClose();
  };

  const handleSaveCustomCoords = () => {
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const address = customAddress.trim() || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    saveManualLocation({
      latitude: lat,
      longitude: lon,
      address,
    });

    const newLoc: LocationResult = {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
      address,
      source: "manual",
      timestamp: Date.now(),
    };

    onLocationUpdated(newLoc);
    onClose();
  };

  const handleResetToDeviceGps = () => {
    clearManualLocation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FiMapPin className="text-red-600 text-xl" />
            <h2 className="text-lg font-bold text-gray-900">Set Exact Physical Location</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          If your device or browser is reporting an inaccurate network/ISP city, you can search your exact street or paste Google Maps coordinates here. This will be broadcast to your trusted contacts during an emergency.
        </p>

        {/* Option 1: Search by Place or Street Name */}
        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
            Option 1: Search your street or area
          </label>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="e.g. Yaba College of Technology, Lagos"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {/* Search Results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-48 overflow-y-auto">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left p-3 hover:bg-red-50/60 transition flex items-start gap-2 text-xs"
                >
                  <FiNavigation className="text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">{item.displayName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Lat: {item.latitude.toFixed(5)}, Lon: {item.longitude.toFixed(5)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400 font-semibold">Or set coordinates directly</span>
          </div>
        </div>

        {/* Option 2: Direct Latitude / Longitude */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Location Name / Street Address
            </label>
            <input
              type="text"
              placeholder="e.g. My Apartment, Victoria Island"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="text"
                placeholder="6.5244"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="text"
                placeholder="3.3792"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveCustomCoords}
            disabled={!customLat || !customLon}
            className="w-full bg-gray-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
          >
            <FiCheck /> Save Exact Location
          </button>
        </div>

        {/* Reset to GPS */}
        {currentLocation?.source === "manual" && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
            <button
              type="button"
              onClick={handleResetToDeviceGps}
              className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
            >
              Reset to Device Automatic GPS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

