export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  source: "gps" | "network" | "manual" | "ip" | "cached" | "fallback";
  timestamp: number;
  errorDetail?: string;
}

const STORAGE_KEY = "safeguardian_last_location";
const MANUAL_LOCATION_KEY = "safeguardian_manual_location";

export interface ManualLocation {
  latitude: number;
  longitude: number;
  address: string;
}

/**
 * Gets user-saved custom physical location if set
 */
export function getSavedManualLocation(): ManualLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MANUAL_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Saves user-verified custom physical location
 */
export function saveManualLocation(loc: ManualLocation): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(loc));
    // Also update main cache
    cacheLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: 10,
      address: loc.address,
      source: "manual",
      timestamp: Date.now(),
    });
  } catch {}
}

/**
 * Clears saved manual location
 */
export function clearManualLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MANUAL_LOCATION_KEY);
  } catch {}
}

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
  } catch {}
  return null;
}

/**
 * Persists location to localStorage for offline and emergency fallback.
 */
export function cacheLocation(loc: LocationResult): void {
  if (typeof window === "undefined") return;
  try {
    if (!loc.latitude && !loc.longitude) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {}
}

/**
 * Clears cached location
 */
export function clearCachedLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Resilient reverse geocoding with multiple fallback providers.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (!lat && !lon) return "Location coordinates unavailable";

  // Provider 1: Nominatim (OpenStreetMap)
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
          addr.road || addr.pedestrian || addr.footway || addr.suburb,
          addr.neighbourhood || addr.quarter || addr.suburb,
          addr.city || addr.town || addr.village || addr.state_district,
          addr.state,
        ].filter(Boolean);

        const uniqueParts = Array.from(new Set(parts));
        if (uniqueParts.length > 0) return uniqueParts.join(", ");
      }
      if (data.display_name) return data.display_name;
    }
  } catch {}

  // Provider 2: BigDataCloud Reverse Geocoding
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
  } catch {}

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Searches places/addresses by query string (Forward Geocoding)
 * Allows users to type their current exact street/neighborhood address
 */
export async function searchAddress(query: string): Promise<Array<{
  displayName: string;
  latitude: number;
  longitude: number;
}>> {
  if (!query || query.trim().length < 2) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&addressdetails=1`,
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
      if (Array.isArray(data)) {
        return data.map((item) => ({
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }));
      }
    }
  } catch {}

  return [];
}

/**
 * Fetches location via IP-based Geolocation services (Last Resort)
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
        reject(new Error(`GPS search timed out after ${Math.round(timeoutMs / 1000)}s`));
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
        let msg = "Location lookup failed";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permission denied: Location access was blocked in your browser or operating system";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Location position unavailable: No satellite/Wi-Fi fix available";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS timed out waiting for hardware fix";
        }
        reject(new Error(msg));
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

export interface GetBestLocationOptions {
  forceFresh?: boolean;
  onAddressUpdate?: (address: string) => void;
}

/**
 * Multi-Tier Accurate Location Resolver
 *
 * 1. User manual override (if user set exact location, respect it!)
 * 2. Real GPS Hardware (High Accuracy)
 * 3. Wi-Fi / Cell Triangulation (Low Accuracy)
 * 4. Recent Real GPS / Manual cached position
 * 5. IP-based ISP Geolocation (Last resort)
 * 6. Fallback
 */
export async function getBestLocation(
  optionsOrCallback?: ((address: string) => void) | GetBestLocationOptions
): Promise<LocationResult> {
  const options: GetBestLocationOptions =
    typeof optionsOrCallback === "function"
      ? { onAddressUpdate: optionsOrCallback }
      : optionsOrCallback || {};

  const { forceFresh = false, onAddressUpdate } = options;

  // Tier 0: User-verified manual location (highest accuracy when device lacks GPS hardware)
  const manual = getSavedManualLocation();
  if (manual && !forceFresh) {
    const manualResult: LocationResult = {
      latitude: manual.latitude,
      longitude: manual.longitude,
      accuracy: 10,
      address: manual.address,
      source: "manual",
      timestamp: Date.now(),
    };
    onAddressUpdate?.(manual.address);
    return manualResult;
  }

  let gpsErrorReason = "";

  // Tier 1: Real GPS / Hardware High Accuracy (10 second window)
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

    reverseGeocode(coords.latitude, coords.longitude).then((addr) => {
      result.address = addr;
      cacheLocation(result);
      onAddressUpdate?.(addr);
    });

    return result;
  } catch (err1: unknown) {
    gpsErrorReason = err1 instanceof Error ? err1.message : String(err1);
    console.warn("Tier 1 GPS High Accuracy lock failed:", gpsErrorReason);
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
  } catch (err2: unknown) {
    if (!gpsErrorReason) {
      gpsErrorReason = err2 instanceof Error ? err2.message : String(err2);
    }
    console.warn("Tier 2 Wi-Fi/Cell Triangulation failed:", err2);
  }

  // Tier 3: If manual location exists, return it even if forceFresh was true but hardware GPS failed
  if (manual) {
    const manualResult: LocationResult = {
      latitude: manual.latitude,
      longitude: manual.longitude,
      accuracy: 10,
      address: manual.address,
      source: "manual",
      timestamp: Date.now(),
    };
    onAddressUpdate?.(manual.address);
    return manualResult;
  }

  // Tier 4: Recent cached GPS / Network location
  const cached = getLastCachedLocation();
  if (cached && (cached.source === "gps" || cached.source === "network" || cached.source === "manual")) {
    const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    if (ageHours < 24) {
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
  }

  // Tier 5: IP-based Geolocation (Last resort when GPS hardware is unavailable)
  try {
    const ipLoc = await fetchIpLocation();
    if (ipLoc) {
      ipLoc.errorDetail = gpsErrorReason || "Hardware GPS not responding; approximate ISP hub used";
      cacheLocation(ipLoc);
      if (ipLoc.address) {
        onAddressUpdate?.(ipLoc.address);
      }
      return ipLoc;
    }
  } catch (err3) {
    console.warn("Tier 5 IP Geolocation failed:", err3);
  }

  // Tier 6: Emergency safe fallback
  const emergencyFallback: LocationResult = {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    address: "Location unavailable (GPS & Network timed out)",
    source: "fallback",
    timestamp: Date.now(),
    errorDetail: gpsErrorReason,
  };

  onAddressUpdate?.(emergencyFallback.address!);
  return emergencyFallback;
}
