import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";

export interface BackgroundLocationFix {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  altitude?: number;
  time?: number;
}

// Interface for @capacitor-community/background-geolocation plugin
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: BackgroundLocationFix | null, error?: { message: string }) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

let BackgroundGeolocation: BackgroundGeolocationPlugin | null = null;

if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
  try {
    BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  } catch (err) {
    console.warn("[BackgroundGeolocation] Native plugin registration notice:", err);
  }
}

let activeWatcherId: string | null = null;

/**
 * Checks whether the app is running inside native Android / iOS Capacitor container
 */
export function isNativeAndroidApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/**
 * Starts continuous background geolocation tracking.
 * On Android, this spins up an Android Foreground Service with a persistent notification
 * ensuring that GPS location updates continue even when the phone is locked, the screen is turned off,
 * or the user switches to other applications.
 */
export async function startBackgroundTracking(
  onLocationUpdate: (location: BackgroundLocationFix) => void
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Native Capacitor Android/iOS Environment
  if (Capacitor.isNativePlatform() && BackgroundGeolocation) {
    try {
      // Clear any existing active watcher
      if (activeWatcherId) {
        await BackgroundGeolocation.removeWatcher({ id: activeWatcherId }).catch(() => {});
        activeWatcherId = null;
      }

      console.log("[BackgroundGeolocation] Starting native Android background foreground tracking service...");

      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: "🚨 SafeAlert Guardian - Emergency SOS",
          backgroundMessage: "Live emergency GPS tracking is active. Real-time location is being broadcast to trusted contacts.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5, // Triggers every 5 meters moved
        },
        (location, error) => {
          if (error) {
            console.warn("[BackgroundGeolocation] Native background location error:", error.message);
            return;
          }
          if (location && location.latitude && location.longitude) {
            console.log(
              `[BackgroundGeolocation] Native background GPS fix: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
            );
            onLocationUpdate(location);
          }
        }
      );

      activeWatcherId = watcherId;
      return true;
    } catch (nativeErr) {
      console.error("[BackgroundGeolocation] Failed to start native background watcher:", nativeErr);
    }
  }

  // 2. Web Browser Fallback (HTML5 Geolocation)
  console.log("[BackgroundGeolocation] Running in browser: using HTML5 watchPosition stream.");
  return false;
}

/**
 * Stops background location tracking and removes the Android persistent notification.
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (typeof window === "undefined") return;

  if (activeWatcherId && BackgroundGeolocation) {
    try {
      console.log("[BackgroundGeolocation] Stopping native background tracking service...");
      await BackgroundGeolocation.removeWatcher({ id: activeWatcherId });
      activeWatcherId = null;
    } catch (err) {
      console.warn("[BackgroundGeolocation] Error stopping watcher:", err);
    }
  }
}

