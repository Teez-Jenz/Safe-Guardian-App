"use client";

import { useEffect, useState } from "react";
import {
  requestNotificationPermission,
  onForegroundMessage,
} from "@/lib/firebase-messaging";
import { supabase } from "@/lib/supabase";
import {
  FiBell,
  FiCheckCircle,
  FiAlertTriangle,
  FiShield,
  FiX,
  FiInfo,
} from "react-icons/fi";

interface EnableNotificationsProps {
  userId?: string | null;
  className?: string;
}

export default function EnableNotifications({
  userId,
  className = "",
}: EnableNotificationsProps) {
  const [permissionState, setPermissionState] =
    useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check initial browser notification permission
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((permissionStatus) => {
          const mapped =
            permissionStatus.state === "granted"
              ? "granted"
              : permissionStatus.state === "denied"
              ? "denied"
              : "default";
          setPermissionState(mapped);

          permissionStatus.onchange = () => {
            const nextMapped =
              permissionStatus.state === "granted"
                ? "granted"
                : permissionStatus.state === "denied"
                ? "denied"
                : "default";
            setPermissionState(nextMapped);
          };
        })
        .catch(() => {
          setTimeout(() => {
            setPermissionState(Notification.permission);
          }, 0);
        });
    } else {
      setTimeout(() => {
        setPermissionState(Notification.permission);
      }, 0);
    }

    // Listen for foreground FCM push messages
    const unsubscribe = onForegroundMessage((payload) => {
      const title =
        payload.notification?.title ||
        payload.data?.title ||
        "🚨 SafeAlert Guardian";
      const body =
        payload.notification?.body ||
        payload.data?.body ||
        "New safety alert received.";

      setStatusMessage({
        type: "info",
        text: `${title}: ${body}`,
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const saveTokenToSupabase = async (token: string, curUserId: string | null) => {
    if (!curUserId) {
      console.log("No logged-in user ID, token saved locally.");
      return;
    }

    try {
      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: curUserId,
          token: token,
          device_type: "web",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );

      if (error) {
        // Fallback: If table doesn't exist yet, we don't break the user experience
        console.warn("Could not save FCM token to Supabase (check if fcm_tokens table exists):", error);
      } else {
        console.log("FCM token successfully registered to Supabase!");
      }
    } catch (err) {
      console.warn("FCM token sync error:", err);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const token = await requestNotificationPermission();

      if (token) {
        setPermissionState("granted");
        setStatusMessage({
          type: "success",
          text: "Push notifications successfully activated on this device!",
        });

        // Resolve user ID if not passed directly
        let resolvedUserId = userId;
        if (!resolvedUserId) {
          try {
            const res = await fetch("/api/session");
            if (res.ok) {
              const data = await res.json();
              resolvedUserId = data.session?.userId;
            }
          } catch (e) {
            console.warn("Session check failed:", e);
          }
        }

        await saveTokenToSupabase(token, resolvedUserId || null);
      } else {
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          setPermissionState("denied");
          setStatusMessage({
            type: "error",
            text: "Notifications were blocked in your browser settings. Please click the lock/settings icon in your URL bar to allow notifications.",
          });
        } else {
          setStatusMessage({
            type: "error",
            text: "Could not activate notifications. Please check your browser support and internet connection.",
          });
        }
      }
    } catch (err) {
      console.error("Error enabling notifications:", err);
      setStatusMessage({
        type: "error",
        text: "An error occurred while enabling notifications.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  // If already granted and no active alert message, show sleek active badge or mini pill
  if (permissionState === "granted" && !statusMessage) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <FiBell className="text-emerald-600" />
        <span>Live Push Alerts Active</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-sm ${
        permissionState === "denied"
          ? "bg-amber-50/80 border-amber-200"
          : "bg-white border-blue-100 ring-1 ring-blue-50"
      } p-4 md:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-xl shrink-0 ${
              permissionState === "denied"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {permissionState === "denied" ? (
              <FiAlertTriangle className="text-xl" />
            ) : (
              <FiBell className="text-xl animate-bounce" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-bold text-gray-900">
                {permissionState === "denied"
                  ? "Browser Notifications Blocked"
                  : "Enable Instant Emergency Alerts"}
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                <FiShield className="text-[10px]" /> Recommended
              </span>
            </div>

            <p className="text-xs md:text-sm text-gray-600 mt-1 leading-relaxed">
              {permissionState === "denied"
                ? "Your browser currently blocks alerts. Click the lock icon next to the address bar to permit notifications for emergency SOS broadcasts."
                : "Receive real-time push alerts on this device when SOS is triggered or safety check-in countdowns expire."}
            </p>

            {statusMessage && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : statusMessage.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                {statusMessage.type === "success" && (
                  <FiCheckCircle className="shrink-0 text-emerald-600" />
                )}
                {statusMessage.type === "error" && (
                  <FiAlertTriangle className="shrink-0 text-red-600" />
                )}
                {statusMessage.type === "info" && (
                  <FiInfo className="shrink-0 text-blue-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {permissionState !== "denied" && permissionState !== "granted" && (
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleEnableNotifications}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs md:text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  <FiBell />
                  {loading ? "Requesting Permission..." : "Turn On Push Alerts"}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <FiX className="text-lg" />
        </button>
      </div>
    </div>
  );
}