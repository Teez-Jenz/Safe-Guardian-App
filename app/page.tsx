"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { GrLocation } from "react-icons/gr";
import { MdCancel, MdSensors } from "react-icons/md";
import { FiPhoneCall, FiMail, FiMapPin, FiCheckCircle, FiRefreshCw, FiEdit3 } from "react-icons/fi";
import { useSafety } from "./context/SafetyContext";
import { useShake } from "./context/ShakeContext";
import { supabase } from "@/lib/supabase";
import { getBestLocation, LocationResult } from "@/lib/geolocation";
import EnableNotifications from "./components/EnableNotifications";
import ShakeSettingsCard from "./components/ShakeSettingsCard";
import LocationModal from "./components/LocationModal";

interface Contact {
  name: string;
  email: string;
  phoneNumber: string;
  relationship: string;
}

const Page = () => {
  const [userName, setUserName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { sosActive, sosAlertResult, startSos, stopSos, userId } = useSafety();
  const { shakeCount, registerOnTrigger } = useShake();
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);

  const fetchCurrentLocation = useCallback(async (forceFresh = false) => {
    setIsFetchingLocation(true);
    setLocationError("");
    try {
      const loc = await getBestLocation({
        forceFresh,
        onAddressUpdate: (address) => {
          setLocation((prev) => (prev ? { ...prev, address } : null));
        },
      });
      setLocation(loc);
      return loc;
    } catch (err: unknown) {
      console.warn("Location probe warning:", err);
      return null;
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  // Warm-up location proactively on page mount
  useEffect(() => {
    fetchCurrentLocation(false);
  }, [fetchCurrentLocation]);

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
      fetchCurrentLocation();
    }
  }, [sosActive, location, fetchCurrentLocation]);

  const handleSosClick = async () => {
    if (sosActive) return;

    setLocationError("");
    setIsSending(true);

    try {
      // 1. Resolve location without hanging or crashing on timeout
      let loc = location;
      if (!loc || (!loc.latitude && !loc.longitude)) {
        setIsFetchingLocation(true);
        loc = await getBestLocation({
          forceFresh: true,
          onAddressUpdate: (address) => {
            setLocation((prev) => (prev ? { ...prev, address } : null));
          },
        });
        setLocation(loc);
        setIsFetchingLocation(false);
      }

      // 2. Dispatch SOS emergency broadcast (calls Africa's Talking voice & Brevo email)
      const res = await startSos({
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address,
      });

      if (res && res.success) {
        setAlertMessage(
          `SOS Alert Dispatched: Ringing ${res.calls?.triggered || 0} contact phone(s) & emailed ${res.emails?.sent || 0} contact(s) with Google Maps location.`
        );
      } else {
        setAlertMessage("SOS alert activated and notifications sent to your trusted contacts.");
      }
    } catch (err: unknown) {
      console.error("SOS Trigger Error:", err);
      setLocationError(err instanceof Error ? err.message : "Unable to dispatch emergency alert.");
    } finally {
      setIsFetchingLocation(false);
      setIsSending(false);
    }
  };

  const handleSosClickRef = useRef(handleSosClick);
  useEffect(() => {
    handleSosClickRef.current = handleSosClick;
  });

  // Automatically trigger SOS when user shakes device 3 times
  useEffect(() => {
    const unsubscribe = registerOnTrigger(() => {
      if (!sosActive) {
        handleSosClickRef.current();
      }
    });
    return unsubscribe;
  }, [registerOnTrigger, sosActive]);

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

          <div className="mt-4 pt-4 border-t border-red-500/60 space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-red-700/60 p-3 rounded-lg flex items-center gap-2">
                <FiPhoneCall className="text-lg shrink-0" />
                <span>
                  <strong>Phone Ring:</strong>{" "}
                  {isSending
                    ? "Dialing contact phones via Africa's Talking..."
                    : sosAlertResult
                    ? `${sosAlertResult.calls.triggered} of ${sosAlertResult.calls.total} ringing`
                    : `0 of ${contacts.filter((c) => c.phoneNumber).length} called (Ready)`}
                </span>
              </div>
              <div className="bg-red-700/60 p-3 rounded-lg flex items-center gap-2">
                <FiMail className="text-lg shrink-0" />
                <span>
                  <strong>Email Alerts:</strong>{" "}
                  {isSending
                    ? "Dispatching emails..."
                    : sosAlertResult
                    ? `${sosAlertResult.emails.sent} delivered${
                        sosAlertResult.emails.failed > 0
                          ? ` (${sosAlertResult.emails.failed} failed)`
                          : ""
                      }`
                    : `0 of ${contacts.filter((c) => c.email).length} delivered (Ready)`}
                </span>
              </div>
            </div>

            {sosAlertResult?.callError && (
              <div className="bg-red-800/80 border border-red-400/40 p-2.5 rounded-lg text-xs text-red-100 flex items-start gap-2">
                <span className="font-bold shrink-0">⚠️ Africa's Talking Notice:</span>
                <span>{sosAlertResult.callError}</span>
              </div>
            )}

            {sosAlertResult?.emailError && (
              <div className="bg-red-800/80 border border-red-400/40 p-2.5 rounded-lg text-xs text-red-100 flex items-start gap-2">
                <span className="font-bold shrink-0">⚠️ Brevo Notice:</span>
                <span>{sosAlertResult.emailError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push Notifications Opt-In Banner */}
      <EnableNotifications userId={userId} className="mb-6" />

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
                  : shakeCount === 2
                  ? "bg-red-600 scale-110 shadow-[0_0_40px_10px_rgba(249,115,22,0.6)] ring-8 ring-orange-400 animate-shake-urgent"
                  : shakeCount === 1
                  ? "bg-red-600 scale-105 shadow-xl ring-6 ring-amber-300 animate-shake-gentle"
                  : "bg-red-600 hover:scale-105 hover:bg-red-700 shadow-xl active:scale-95 ring-4 ring-red-100"
              }
              disabled:cursor-not-allowed
            `}
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center p-6">
              <HiOutlineExclamationCircle className={`text-white text-4xl ${shakeCount > 0 ? "animate-spin" : ""}`} />
              <span className="text-4xl font-black text-white tracking-wider">SOS</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-red-100">
                {isFetchingLocation
                  ? "Getting GPS..."
                  : sosActive
                  ? "Active & Alerting"
                  : shakeCount === 2
                  ? "Shake 2/3! One More!"
                  : shakeCount === 1
                  ? "Shake 1/3 Detected"
                  : "Tap or Shake 3x"}
              </span>
            </div>
          </button>

          {/* Shake Tip Indicator */}
          {!sosActive && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-100 px-3.5 py-1.5 rounded-full border border-gray-200">
              <MdSensors className="text-red-600 animate-pulse text-base" />
              <span>Tip: Shake device 3x in an emergency to trigger hands-free</span>
            </div>
          )}

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

            <div className="flex items-center gap-2">
              {location && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    location.source === "gps"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : location.source === "manual"
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : location.source === "network"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : location.source === "ip"
                      ? "bg-sky-100 text-sky-800 border-sky-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}
                >
                  <FiCheckCircle className="shrink-0" />
                  {location.source === "gps"
                    ? `GPS (±${Math.round(location.accuracy)}m)`
                    : location.source === "manual"
                    ? "Custom Exact Address"
                    : location.source === "network"
                    ? "Wi-Fi Triangulated"
                    : location.source === "ip"
                    ? "Network / IP"
                    : "Cached Location"}
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                disabled={sosActive}
                title="Edit / Search your exact street or coordinates"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-black bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300 shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                <FiEdit3 className="text-xs text-red-600" />
                <span>Set Exact Area</span>
              </button>

              <button
                type="button"
                onClick={() => fetchCurrentLocation(true)}
                disabled={isFetchingLocation || sosActive}
                title="Force refresh high-accuracy GPS coordinates"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-black bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300 shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                <FiRefreshCw className={`text-xs ${isFetchingLocation ? "animate-spin text-red-600" : ""}`} />
                <span>{isFetchingLocation ? "Locking GPS..." : "Refresh GPS"}</span>
              </button>
            </div>
          </div>

          {location?.source === "ip" && !isFetchingLocation && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <span className="text-base shrink-0">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold">Showing approximate Network/IP location</p>
                <p className="text-amber-800">
                  {location.errorDetail
                    ? `Reason: ${location.errorDetail}. `
                    : "Your device or browser has not provided a direct GPS fix. "}
                  You can tap <strong>Set Exact Area</strong> to search your street or place, or tap <strong>Refresh GPS</strong> after ensuring your browser permission is set to <em>Allow</em>.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="inline-flex items-center gap-1 font-bold text-amber-900 underline mt-1 cursor-pointer"
                >
                  <FiEdit3 /> Set your exact street/neighborhood now →
                </button>
              </div>
            </div>
          )}

          {locationError && (
            <p className="text-sm font-medium text-red-600 mt-3">{locationError}</p>
          )}

          {isFetchingLocation && (
            <p className="text-sm text-gray-500 mt-3 animate-pulse">
              Acquiring high-accuracy GPS & network coordinates...
            </p>
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
                    Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
                    {location.source === "ip"
                      ? " (detected via secure network IP)"
                      : location.source === "cached"
                      ? " (last recorded position)"
                      : ` (±${Math.round(location.accuracy)}m accuracy)`}
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

      {/* Shake-to-SOS Detection Settings Card */}
      <div className="mt-6">
        <ShakeSettingsCard />
      </div>

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

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  {sosActive && contact.phoneNumber && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                      <FiPhoneCall className="animate-pulse" /> Auto Ring Dispatched
                    </span>
                  )}
                  {contact.phoneNumber && (
                    <button
                      onClick={() => handleDirectCall(contact.phoneNumber)}
                      title={`Direct Call ${contact.name}`}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-xs cursor-pointer shrink-0"
                    >
                      <FiPhoneCall /> Direct Call
                    </button>
                  )}
                </div>
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
      {/* Manual Location Override Modal */}
      {showLocationModal && (
        <LocationModal
          currentLocation={location}
          onLocationUpdated={(newLoc) => {
            setLocation(newLoc);
          }}
          onClose={() => {
            setShowLocationModal(false);
            fetchCurrentLocation(false);
          }}
        />
      )}
    </main>
  );
};

export default Page;
