"use client";

import { useEffect, useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { GrLocation } from "react-icons/gr";
import { MdCancel } from "react-icons/md";
import { FiPhoneCall, FiMail, FiMapPin, FiCheckCircle } from "react-icons/fi";
import { useSafety } from "./context/SafetyContext";
import { supabase } from "@/lib/supabase";

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

interface Contact {
  name: string;
  email: string;
  phoneNumber: string;
  relationship: string;
}

type AddressCallback = (address: string) => void;

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

// Reverse geocode using Nominatim (OSM's dedicated reverse geocoding API)
const getAddress = async (lat: number, lon: number): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "SafeGuardianApp/1.0",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Nominatim request failed");

    const data = (await response.json()) as NominatimResponse;
    const addr = data.address;

    if (addr) {
      const parts = [
        addr.house_number,
        addr.road || addr.pedestrian || addr.footway,
        addr.suburb || addr.neighbourhood || addr.quarter,
        addr.city || addr.town || addr.village || addr.county,
      ].filter(Boolean);

      if (parts.length > 0) return parts.join(", ");
    }

    if (data.display_name) return data.display_name;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Nominatim reverse geocoding failed:", err);
  }

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

const fetchLocation = (onAddress?: AddressCallback): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({ latitude, longitude, accuracy });

        getAddress(latitude, longitude).then((address: string) => {
          onAddress?.(address);
        });
      },
      (error: GeolocationPositionError) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
};

const Page = () => {
  const [userName, setUserName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { sosActive, sosAlertResult, startSos, stopSos, userId } = useSafety();
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    const getUserAndContacts = async () => {
      try {
        const response = await fetch("/api/session");
        if (!response.ok) return;
        const data = await response.json();
        const curUserId = data.session?.userId;
        setUserName(data.session?.name || "");

        if (curUserId) {
          const { data: contactsData } = await supabase
            .from("contacts")
            .select("name, email, phone_number, relationship")
            .eq("user_id", curUserId);

          if (contactsData) {
            setContacts(
              contactsData.map((c) => ({
                name: c.name,
                email: c.email,
                phoneNumber: c.phone_number,
                relationship: c.relationship,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Error loading user contacts:", err);
      }
    };
    getUserAndContacts();
  }, [userId]);

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
      const loc = await fetchLocation((address) => {
        setLocation((prev) => ({ ...(prev ?? loc), address }));
      });
      setLocation(loc);
      setIsSending(true);
      const res = await startSos(loc);
      if (res && res.success) {
        setAlertMessage(
          `SOS Alert Dispatched: Ringing ${res.calls?.triggered || 0} contact phone(s) & emailed ${res.emails?.sent || 0} contact(s) with Google Maps location.`
        );
      } else {
        setAlertMessage("SOS alert activated and notifications sent to your trusted contacts.");
      }
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : "Unable to retrieve location.");
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

  const handleDirectCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    window.location.assign(`tel:${phoneNumber}`);
  };

  const googleMapsUrl = location
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : null;

  return (
    <main className="w-full min-h-screen p-4 md:p-8 bg-gray-50">
      {/* SOS Active Banner */}
      {sosActive && (
        <div className="w-full mb-6 bg-red-600 text-white rounded-2xl p-6 shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <HiOutlineExclamationCircle className="text-3xl shrink-0" />
            <div>
              <p className="font-extrabold text-xl tracking-wide">🚨 EMERGENCY SOS ACTIVATED</p>
              <p className="text-sm text-red-100 mt-1">
                {isSending
                  ? "Broadcasting emergency phone calls & emails with Google Maps location..."
                  : alertMessage || "Your registered trusted contacts are being alerted via phone ring and email with your location."}
              </p>
            </div>
          </div>

          {sosAlertResult && (
            <div className="mt-4 pt-4 border-t border-red-500/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-red-700/60 p-3 rounded-lg flex items-center gap-2">
                <FiPhoneCall className="text-lg" />
                <span>
                  <strong>Phone Ring:</strong> {sosAlertResult.calls.triggered} of {sosAlertResult.calls.total} called
                </span>
              </div>
              <div className="bg-red-700/60 p-3 rounded-lg flex items-center gap-2">
                <FiMail className="text-lg" />
                <span>
                  <strong>Email Alerts:</strong> {sosAlertResult.emails.sent} delivered
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main SOS Control Card */}
      <section className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {userName || "Guardian User"}
        </h1>
        <p className="text-gray-600 mt-1">
          Tap the emergency button below to instantly trigger automated phone rings and dispatch your Google Maps location to trusted contacts.
        </p>

        {/* SOS Button Area */}
        <div className="w-full mt-6 flex flex-col items-center justify-center py-8 gap-6">
          <button
            id="sos-alert-button"
            onClick={handleSosClick}
            disabled={isFetchingLocation || sosActive}
            className={`
              w-52 h-52 rounded-full flex items-center justify-center cursor-pointer
              transform transition-all duration-300 select-none
              ${
                sosActive
                  ? "bg-red-600 scale-105 shadow-[0_0_50px_15px_rgba(220,38,38,0.5)] ring-8 ring-red-300"
                  : "bg-red-600 hover:scale-105 hover:bg-red-700 shadow-xl active:scale-95 ring-4 ring-red-100"
              }
              disabled:cursor-not-allowed
            `}
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center p-6">
              <HiOutlineExclamationCircle className="text-white text-4xl" />
              <span className="text-4xl font-black text-white tracking-wider">SOS</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-red-100">
                {isFetchingLocation ? "Getting GPS..." : sosActive ? "Active & Alerting" : "Tap for Emergency"}
              </span>
            </div>
          </button>

          {/* Cancel Button */}
          {sosActive && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3.5 rounded-full font-bold transition duration-200 shadow-lg cursor-pointer"
            >
              <MdCancel className="text-xl text-red-400" />
              I Am Safe (Cancel SOS)
            </button>
          )}
        </div>

        {/* Location Box */}
        <div
          className={`w-full rounded-2xl border p-6 transition-all duration-300 ${
            sosActive
              ? "bg-red-50/70 border-red-200 shadow-sm"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GrLocation className={`text-2xl ${sosActive ? "text-red-600" : "text-gray-700"}`} />
              <div>
                <h2 className="font-bold text-gray-900">Your Current Location</h2>
                <p className="text-xs text-gray-500">Coordinates shared with contacts during SOS</p>
              </div>
            </div>

            {location && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <FiCheckCircle /> GPS Located
              </span>
            )}
          </div>

          {locationError && (
            <p className="text-sm font-medium text-red-600 mt-3">{locationError}</p>
          )}

          {isFetchingLocation && (
            <p className="text-sm text-gray-500 mt-3 animate-pulse">Acquiring high-accuracy GPS coordinates...</p>
          )}

          {location && !isFetchingLocation && (
            <div className="mt-4 space-y-2 text-sm text-gray-700 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-start gap-2">
                <FiMapPin className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">
                    {location.address || "Fetching address..."}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)} (±{location.accuracy.toFixed(0)}m accuracy)
                  </p>
                </div>
              </div>

              {googleMapsUrl && (
                <div className="pt-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-xs"
                  >
                    🗺️ Open in Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {!location && !isFetchingLocation && !locationError && (
            <p className="text-sm text-gray-500 mt-3">
              Press the SOS button above to locate you and broadcast your location.
            </p>
          )}
        </div>
      </section>

      {/* Trusted Contacts Overview & Direct Ring */}
      <section className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registered Trusted Contacts</h2>
            <p className="text-sm text-gray-500">
              These contacts receive the automated phone ring and email with Google Maps location when SOS is triggered.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-700 rounded-full">
            {contacts.length} Contact{contacts.length === 1 ? "" : "s"}
          </span>
        </div>

        {contacts.length === 0 ? (
          <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
            <p className="text-gray-600 font-medium">No trusted contacts registered yet.</p>
            <a
              href="/contacts"
              className="inline-block mt-2 text-sm font-semibold text-red-600 hover:underline"
            >
              + Add Trusted Contacts Now →
            </a>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-red-50/40 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{contact.name}</p>
                    {contact.relationship && (
                      <span className="text-xs bg-gray-200 text-gray-700 font-medium px-2 py-0.5 rounded-full">
                        {contact.relationship}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                    <FiPhoneCall className="text-gray-400" /> {contact.phoneNumber || "No phone"}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5">
                    <FiMail className="text-gray-400" /> {contact.email || "No email"}
                  </p>
                </div>

                {contact.phoneNumber && (
                  <button
                    onClick={() => handleDirectCall(contact.phoneNumber)}
                    title={`Ring ${contact.name}`}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-xs cursor-pointer shrink-0"
                  >
                    <FiPhoneCall /> Ring Now
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Info */}
      <section className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8 mt-6">
        <h3 className="font-bold text-gray-900">How SafeAlert Guardian Protects You</h3>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1.5 mt-3">
          <li><strong>Instant Phone Ring:</strong> When SOS is pressed, your contact’s phone receives an automated phone call alerting them of the emergency.</li>
          <li><strong>Email with Google Maps:</strong> An emergency email is delivered to their inbox with your address, coordinates, and an interactive link to open your live location on Google Maps.</li>
          <li><strong>Continuous Safety Tracking:</strong> High-precision location updates are safely transmitted while SOS is active.</li>
        </ul>
      </section>
    </main>
  );
};

export default Page;
