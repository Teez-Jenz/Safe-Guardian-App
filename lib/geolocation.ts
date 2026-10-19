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
    if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Resilient reverse geocoding with multiple fallback providers.
 * 1. OpenStreetMap Nominatim
 * 2. BigDataCloud Reverse Geocode Client API
 * 3. Formatted lat/lon fallback
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  // If coordinates are invalid or 0, return fallback
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

  // Provider 2: BigDataCloud Reverse Geocoding (fast, no API key needed, 3s timeout)
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
 * Essential for laptops, desktop computers, and devices where GPS hardware is absent
 * or Windows Location Services times out.
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
        const address = [data.city, data.region, data.country_name]
          .filter(Boolean)
          .join(", ") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        return {
          latitude: lat,
          longitude: lon,
          accuracy: 5000, // IP geolocation is typically city-level ~5km
          address,
          source: "ip",
          timestamp: Date.now(),
        };
      }
    }
  } catch {
    // ipapi.co failed, try next
  }

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
        const address = [data.city, data.region, data.country]
          .filter(Boolean)
          .join(", ") || `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;

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
  } catch {
    // ipwho.is failed
  }

  return null;
}

/**
 * Attempts browser HTML5 geolocation with a specific configuration.
 */
function attemptBrowserGeolocation(
  enableHighAccuracy: boolean,
  timeoutMs: number,
  maxAgeMs: number
): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Browser geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || (enableHighAccuracy ? 15 : 100),
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: maxAgeMs,
      }
    );
  });
}

/**
 * Multi-Tier Resilient Location Resolver
 *
 * Designed specifically to prevent "Timeout expired" blocking emergency SOS.
 *
 * Tier 1: Browser GPS High Accuracy (5s timeout)
 * Tier 2: Browser Low Accuracy / Wi-Fi Triangulation (5s timeout)
 * Tier 3: IP-Based Geolocation (city-level, works on laptops/desktops without GPS hardware)
 * Tier 4: Last Cached Location from LocalStorage
 * Tier 5: Safe fallback object (NEVER throws / crashes SOS dispatch)
 */
export async function getBestLocation(
  onAddressUpdate?: (address: string) => void
): Promise<LocationResult> {
  // Tier 1: High Accuracy Browser GPS (5 seconds)
  try {
    const coords = await attemptBrowserGeolocation(true, 5000, 30000);
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
  } catch (err1) {
    console.warn("Tier 1 GPS High Accuracy timed out or failed:", err1);
  }

  // Tier 2: Standard/Low Accuracy Browser Triangulation (5 seconds, allows 5min cached position)
  try {
    const coords = await attemptBrowserGeolocation(false, 5000, 300000);
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
    console.warn("Tier 2 Browser Standard Accuracy timed out or failed:", err2);
  }

  // Tier 3: IP-based Geolocation (instant, no GPS hardware required)
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
    console.warn("Tier 3 IP Geolocation failed:", err3);
  }

  // Tier 4: Last known cached location
  const cached = getLastCachedLocation();
  if (cached) {
    const cachedResult: LocationResult = {
      ...cached,
      source: "cached",
      address: cached.address
        ? `${cached.address} (last known)`
        : "Last known recorded location",
    };
    if (cachedResult.address) {
      onAddressUpdate?.(cachedResult.address);
    }
    return cachedResult;
  }

  // Tier 5: Emergency fallback (ensures SOS can still trigger even in worst-case failure)
  const emergencyFallback: LocationResult = {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    address: "Location unavailable (GPS & Network timed out)",
    source: "fallback",
    timestamp: Date.now(),
  };

  onAddressUpdate?.(emergencyFallback.address!);
  return emergencyFallback;
}
