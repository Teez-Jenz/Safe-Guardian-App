export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  source: "gps" | "network" | "ip" | "cached" | "fallback";
  timestamp: number;
}

const STORAGE_KEY = "safeguardian_last_location";

/**
 * Retrieves the last known location cached in browser localStorage.
 */
export function getLastCachedLocation(): LocationResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationResult;
    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      parsed.latitude !== 0 &&
      parsed.longitude !== 0
    ) {
      return parsed;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

/**
 * Persists location to localStorage for offline and emergency fallback.
 */
export function cacheLocation(loc: LocationResult): void {
  if (typeof window === "undefined") return;
  try {
    // Don't cache 0,0 fallbacks
    if (!loc.latitude && !loc.longitude) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clears cached location (useful when switching networks or forcing fresh GPS lock)
 */
export function clearCachedLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Resilient reverse geocoding with multiple fallback providers.
 * 1. OpenStreetMap Nominatim
 * 2. BigDataCloud Reverse Geocode Client API
 * 3. Formatted lat/lon fallback
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (!lat && !lon) return "Location coordinates unavailable";

  // Provider 1: Nominatim (4s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
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

    if (res.ok) {
      const data = await res.json();
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
    }
  } catch {
    // Nominatim timed out or failed, try next provider
  }

  // Provider 2: BigDataCloud Reverse Geocoding (3.5s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const parts = [
        data.locality,
        data.city,
        data.principalSubdivision,
        data.countryName,
      ].filter(Boolean);

      const uniqueParts = Array.from(new Set(parts));
      if (uniqueParts.length > 0) {
        return uniqueParts.join(", ");
      }
    }
  } catch {
    // BigDataCloud failed or timed out
  }

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Fetches location via IP-based Geolocation services.
 * NOTE: IP addresses resolve to internet service provider (ISP) hubs or server data centers,
 * which may be miles or cities away from the user's actual physical location.
 * Used strictly as a last-resort fallback.
 */
async function fetchIpLocation(): Promise<LocationResult | null> {
  // Provider 1: ipapi.co
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch("https://ipapi.co/json/", {
      headers: { "User-Agent": "SafeGuardianApp/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        const address =
          [data.city, data.region, data.country_name].filter(Boolean).join(", ") ||
          `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        return {
          latitude: lat,
          longitude: lon,
          accuracy: 5000,
          address,
          source: "ip",
          timestamp: Date.now(),
        };
      }
    }
  } catch {}

  // Provider 2: ipwho.is
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch("https://ipwho.is/", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.latitude === "number" && typeof data.longitude === "number") {
        const address =
          [data.city, data.region, data.country].filter(Boolean).join(", ") ||
          `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;

        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 5000,
          address,
          source: "ip",
          timestamp: Date.now(),
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Attempts real device GPS/Wi-Fi positioning via HTML5 navigator.geolocation.
 * Uses watchPosition instead of getCurrentPosition because watchPosition can stream
 * consecutive location fixes on mobile/laptops and locks onto real hardware GPS
 * much more reliably than a single one-shot query.
 */
function attemptBrowserGeolocation(
  enableHighAccuracy: boolean,
  timeoutMs: number,
  maxAgeMs: number
): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Browser geolocation is not supported on this device/browser"));
    }

    let settled = false;
    let watchId: number | null = null;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(new Error(`Browser geolocation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const successHandler = (pos: GeolocationPosition) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || (enableHighAccuracy ? 10 : 50),
        });
      }
    };

    const errorHandler = (err: GeolocationPositionError) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(err);
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        successHandler,
        errorHandler,
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: maxAgeMs,
        }
      );
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

/**
 * Checks the browser's Geolocation permission state if supported.
 */
export async function getGeolocationPermissionStatus(): Promise<"granted" | "prompt" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !navigator.permissions || !navigator.permissions.query) {
    return "unsupported";
  }
  try {
    const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return res.state;
  } catch {
    return "unsupported";
  }
}

export interface GetBestLocationOptions {
  forceFresh?: boolean;
  onAddressUpdate?: (address: string) => void;
}

/**
 * Multi-Tier Accurate Location Resolver
 *
 * Prioritizes REAL physical GPS / Wi-Fi hardware over ISP IP address:
 *
 * Tier 1: Real GPS High Accuracy (enableHighAccuracy: true, 10s timeout, maxAge: 0 if forceFresh)
 * Tier 2: Real Wi-Fi / Cell Tower Triangulation (enableHighAccuracy: false, 6s timeout)
 * Tier 3: Last known REAL GPS/Network cached location from localStorage (if fresher than 1 hour)
 * Tier 4: IP-based ISP Geolocation (Last resort: approximate city level)
 * Tier 5: Safe fallback
 */
export async function getBestLocation(
  optionsOrCallback?: ((address: string) => void) | GetBestLocationOptions
): Promise<LocationResult> {
  const options: GetBestLocationOptions =
    typeof optionsOrCallback === "function"
      ? { onAddressUpdate: optionsOrCallback }
      : optionsOrCallback || {};

  const { forceFresh = false, onAddressUpdate } = options;

  // Tier 1: True GPS / Hardware High Accuracy (10 second window to lock satellites / Wi-Fi)
  try {
    const coords = await attemptBrowserGeolocation(
      true,
      10000,
      forceFresh ? 0 : 15000
    );

    const result: LocationResult = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      source: "gps",
      timestamp: Date.now(),
    };

    cacheLocation(result);

    // Asynchronously reverse geocode without blocking coordinate return
    reverseGeocode(coords.latitude, coords.longitude).then((addr) => {
      result.address = addr;
      cacheLocation(result);
      onAddressUpdate?.(addr);
    });

    return result;
  } catch (err1) {
    console.warn("Tier 1 GPS High Accuracy lock failed or timed out:", err1);
  }

  // Tier 2: Real Browser Standard/Low Accuracy (Wi-Fi / Cell triangulation, 6 seconds)
  try {
    const coords = await attemptBrowserGeolocation(
      false,
      6000,
      forceFresh ? 0 : 60000
    );

    const result: LocationResult = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      source: "network",
      timestamp: Date.now(),
    };

    cacheLocation(result);

    reverseGeocode(coords.latitude, coords.longitude).then((addr) => {
      result.address = addr;
      cacheLocation(result);
      onAddressUpdate?.(addr);
    });

    return result;
  } catch (err2) {
    console.warn("Tier 2 Wi-Fi/Cell Triangulation failed or timed out:", err2);
  }

  // Tier 3: If user has a previously cached REAL GPS / Network location that is relatively recent (within 24 hours),
  // prefer it over a completely wrong ISP IP address in a different state/country!
  const cached = getLastCachedLocation();
  if (cached && (cached.source === "gps" || cached.source === "network")) {
    const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    if (ageHours < 24) {
      console.log(`Using recent cached physical location from ${cached.source} (${Math.round(ageHours)}h old)`);
      const cachedResult: LocationResult = {
        ...cached,
        source: "cached",
        address: cached.address
          ? `${cached.address} (last known GPS)`
          : "Last known recorded GPS location",
      };
      if (cachedResult.address) {
        onAddressUpdate?.(cachedResult.address);
      }
      return cachedResult;
    }
  }

  // Tier 4: IP-based Geolocation (Last resort when GPS is blocked by browser permissions or unsupported)
  try {
    const ipLoc = await fetchIpLocation();
    if (ipLoc) {
      cacheLocation(ipLoc);
      if (ipLoc.address) {
        onAddressUpdate?.(ipLoc.address);
      }
      return ipLoc;
    }
  } catch (err3) {
    console.warn("Tier 4 IP Geolocation failed:", err3);
  }

  // Tier 5: Older cached location
  if (cached) {
    const cachedResult: LocationResult = {
      ...cached,
      source: "cached",
      address: cached.address
        ? `${cached.address} (last recorded)`
        : "Last recorded location",
    };
    if (cachedResult.address) {
      onAddressUpdate?.(cachedResult.address);
    }
    return cachedResult;
  }

  // Tier 6: Emergency safe fallback
  const emergencyFallback: LocationResult = {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    address: "Location unavailable (Please allow browser Location permissions)",
    source: "fallback",
    timestamp: Date.now(),
  };

  onAddressUpdate?.(emergencyFallback.address!);
  return emergencyFallback;
}
