"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { playShakeTone, triggerHaptic } from "@/lib/shake-feedback";

export type SensitivityLevel = "low" | "medium" | "high";

interface ShakeContextType {
  shakeCount: number;
  isShakeEnabled: boolean;
  setIsShakeEnabled: (enabled: boolean) => void;
  sensitivity: SensitivityLevel;
  setSensitivity: (level: SensitivityLevel) => void;
  isSupported: boolean;
  permissionStatus: "granted" | "denied" | "prompt" | "unsupported";
  requestMotionPermission: () => Promise<boolean>;
  remainingWindowSec: number;
  isShaking: boolean;
  lastShakeTime: number | null;
  simulateShake: () => void;
  simulateTripleShake: () => Promise<void>;
  resetShakeCount: () => void;
  registerOnTrigger: (callback: () => void) => () => void;
}

const ShakeContext = createContext<ShakeContextType | undefined>(undefined);

// Sensitivity thresholds in m/s²
const SENSITIVITY_THRESHOLDS: Record<SensitivityLevel, number> = {
  high: 13,    // Very sensitive, easiest to trigger
  medium: 19,  // Recommended: firm intentional shake
  low: 28,     // Heavy vigorous shake
};

const MIN_SHAKE_INTERVAL_MS = 380;   // Cooldown between individual shakes to prevent multi-counts
const MAX_SHAKE_WINDOW_MS = 3500;    // Time allowed to complete consecutive shakes before resetting
const POST_TRIGGER_COOLDOWN_MS = 8000; // Cooldown after SOS trigger

export const ShakeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [shakeCount, setShakeCount] = useState<number>(0);
  const [isShakeEnabled, setIsShakeEnabledState] = useState<boolean>(true);
  const [sensitivity, setSensitivityState] = useState<SensitivityLevel>("medium");
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "prompt" | "unsupported"
  >("prompt");
  const [remainingWindowSec, setRemainingWindowSec] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lastShakeTime, setLastShakeTime] = useState<number | null>(null);

  const shakeCountRef = useRef<number>(0);
  const lastShakeTimestampRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const triggerListenersRef = useRef<Set<() => void>>(new Set());
  const sensitivityRef = useRef<SensitivityLevel>("medium");
  const isEnabledRef = useRef<boolean>(true);

  // Sync refs
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    isEnabledRef.current = isShakeEnabled;
  }, [isShakeEnabled]);

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedEnabled = localStorage.getItem("sg_shake_enabled");
      if (savedEnabled !== null) {
        const val = savedEnabled === "true";
        setIsShakeEnabledState(val);
        isEnabledRef.current = val;
      }

      const savedSensitivity = localStorage.getItem("sg_shake_sensitivity") as SensitivityLevel | null;
      if (savedSensitivity && ["low", "medium", "high"].includes(savedSensitivity)) {
        setSensitivityState(savedSensitivity);
        sensitivityRef.current = savedSensitivity;
      }
    } catch (e) {
      console.warn("Could not load shake settings from localStorage:", e);
    }
  }, []);

  const setIsShakeEnabled = useCallback((enabled: boolean) => {
    setIsShakeEnabledState(enabled);
    isEnabledRef.current = enabled;
    try {
      localStorage.setItem("sg_shake_enabled", String(enabled));
    } catch {}
  }, []);

  const setSensitivity = useCallback((level: SensitivityLevel) => {
    setSensitivityState(level);
    sensitivityRef.current = level;
    try {
      localStorage.setItem("sg_shake_sensitivity", level);
    } catch {}
  }, []);

  const resetShakeCount = useCallback(() => {
    shakeCountRef.current = 0;
    setShakeCount(0);
    lastShakeTimestampRef.current = 0;
    setRemainingWindowSec(0);
  }, []);

  const registerOnTrigger = useCallback((callback: () => void) => {
    triggerListenersRef.current.add(callback);
    return () => {
      triggerListenersRef.current.delete(callback);
    };
  }, []);

  // Register a single detected shake
  const registerShake = useCallback(() => {
    if (!isEnabledRef.current) return;
    const now = Date.now();

    // Respect post-trigger cooldown
    if (now < cooldownUntilRef.current) {
      return;
    }

    const elapsedSinceLastShake = now - lastShakeTimestampRef.current;

    // Minimum interval guard
    if (elapsedSinceLastShake < MIN_SHAKE_INTERVAL_MS) {
      return;
    }

    let nextCount = 1;
    if (
      lastShakeTimestampRef.current > 0 &&
      elapsedSinceLastShake <= MAX_SHAKE_WINDOW_MS
    ) {
      nextCount = Math.min(3, shakeCountRef.current + 1);
    }

    shakeCountRef.current = nextCount;
    setShakeCount(nextCount);
    lastShakeTimestampRef.current = now;
    setLastShakeTime(now);

    // Visual pulse
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 250);

    // Audio tone & Haptic vibration
    playShakeTone(nextCount as 1 | 2 | 3);
    triggerHaptic(nextCount as 1 | 2 | 3);

    // 3rd Shake: Trigger SOS!
    if (nextCount === 3) {
      cooldownUntilRef.current = now + POST_TRIGGER_COOLDOWN_MS;

      // Dispatch to all registered listeners
      triggerListenersRef.current.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error("Error invoking shake trigger listener:", err);
        }
      });

      // Clear count after brief delay for visual HUD effect
      setTimeout(() => {
        shakeCountRef.current = 0;
        setShakeCount(0);
        setRemainingWindowSec(0);
      }, 1000);
    }
  }, []);

  // Simulate a single shake (useful for testing on desktop/laptop)
  const simulateShake = useCallback(() => {
    registerShake();
  }, [registerShake]);

  // Simulate 3 full shakes with realistic interval
  const simulateTripleShake = useCallback(async () => {
    registerShake();
    await new Promise((r) => setTimeout(r, 550));
    registerShake();
    await new Promise((r) => setTimeout(r, 550));
    registerShake();
  }, [registerShake]);

  // Request motion permission (specifically for iOS 13+ Safari)
  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DME?.requestPermission === "function") {
      try {
        const response = await DME.requestPermission();
        setPermissionStatus(response);
        return response === "granted";
      } catch (err) {
        console.warn("DeviceMotionEvent permission request error:", err);
        setPermissionStatus("denied");
        return false;
      }
    }

    // Android & standard desktop browsers don't require explicit DeviceMotionEvent.requestPermission
    setPermissionStatus("granted");
    return true;
  }, []);

  // Window timeout countdown loop
  useEffect(() => {
    if (shakeCount === 0 || shakeCount >= 3) {
      setRemainingWindowSec(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastShakeTimestampRef.current;
      const remaining = Math.max(0, MAX_SHAKE_WINDOW_MS - elapsed);

      if (remaining <= 0) {
        shakeCountRef.current = 0;
        setShakeCount(0);
        setRemainingWindowSec(0);
      } else {
        setRemainingWindowSec(Number((remaining / 1000).toFixed(1)));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [shakeCount]);

  // Check hardware support & permission state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("DeviceMotionEvent" in window)) {
      setIsSupported(false);
      setPermissionStatus("unsupported");
      return;
    }

    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DME?.requestPermission === "function") {
      setPermissionStatus("prompt");
    } else {
      setPermissionStatus("granted");
    }
  }, []);

  // Motion Event Listener
  useEffect(() => {
    if (typeof window === "undefined" || !isShakeEnabled) return;
    if (permissionStatus === "denied" || permissionStatus === "unsupported") return;

    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    let lastSampleTime = 0;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      // Throttle sampling to ~40ms (~25Hz)
      if (now - lastSampleTime < 40) return;
      const diffTime = (now - lastSampleTime) / 1000;
      lastSampleTime = now;

      const threshold = SENSITIVITY_THRESHOLDS[sensitivityRef.current] || 19;
      let motionMagnitude = 0;

      // Method 1: Clean linear acceleration (gravity removed)
      if (
        event.acceleration &&
        event.acceleration.x !== null &&
        event.acceleration.y !== null &&
        event.acceleration.z !== null
      ) {
        const { x, y, z } = event.acceleration;
        motionMagnitude = Math.sqrt(x * x + y * y + z * z);
      }
      // Method 2: Acceleration including gravity (delta from previous reading)
      else if (
        event.accelerationIncludingGravity &&
        event.accelerationIncludingGravity.x !== null &&
        event.accelerationIncludingGravity.y !== null &&
        event.accelerationIncludingGravity.z !== null
      ) {
        const { x, y, z } = event.accelerationIncludingGravity;
        if (lastX !== null && lastY !== null && lastZ !== null && diffTime > 0) {
          const dx = x - lastX;
          const dy = y - lastY;
          const dz = z - lastZ;
          motionMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        lastX = x;
        lastY = y;
        lastZ = z;
      }

      if (motionMagnitude >= threshold) {
        registerShake();
      }
    };

    window.addEventListener("devicemotion", handleDeviceMotion, { passive: true });

    return () => {
      window.removeEventListener("devicemotion", handleDeviceMotion);
    };
  }, [isShakeEnabled, permissionStatus, registerShake]);

  // Optional keyboard shortcut for desktop testing ('S' or 's' triggers a shake)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "s" || e.key === "S") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          simulateShake();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [simulateShake]);

  return (
    <ShakeContext.Provider
      value={{
        shakeCount,
        isShakeEnabled,
        setIsShakeEnabled,
        sensitivity,
        setSensitivity,
        isSupported,
        permissionStatus,
        requestMotionPermission,
        remainingWindowSec,
        isShaking,
        lastShakeTime,
        simulateShake,
        simulateTripleShake,
        resetShakeCount,
        registerOnTrigger,
      }}
    >
      {children}
    </ShakeContext.Provider>
  );
};

export const useShake = () => {
  const context = useContext(ShakeContext);
  if (context === undefined) {
    throw new Error("useShake must be used within a ShakeProvider");
  }
  return context;
};
