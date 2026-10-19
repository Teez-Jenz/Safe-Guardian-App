"use client";

import React, { useState } from "react";
import { useShake, SensitivityLevel } from "../context/ShakeContext";
import {
  MdSensors,
  MdSensorsOff,
  MdVibration,
  MdSpeed,
  MdCheckCircle,
  MdTune,
} from "react-icons/md";
import { FaApple } from "react-icons/fa";
import { FiPlay, FiRefreshCw } from "react-icons/fi";

export default function ShakeSettingsCard() {
  const {
    shakeCount,
    isShakeEnabled,
    setIsShakeEnabled,
    sensitivity,
    setSensitivity,
    permissionStatus,
    requestMotionPermission,
    simulateShake,
    simulateTripleShake,
    resetShakeCount,
    isSupported,
  } = useShake();

  const [isSimulatingTriple, setIsSimulatingTriple] = useState(false);

  const handleSimulateTriple = async () => {
    setIsSimulatingTriple(true);
    try {
      await simulateTripleShake();
    } finally {
      setIsSimulatingTriple(false);
    }
  };

  const handleGrantPermission = async () => {
    await requestMotionPermission();
  };

  return (
    <section className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isShakeEnabled
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-gray-100 text-gray-400 border border-gray-200"
            }`}
          >
            {isShakeEnabled ? (
              <MdSensors className="text-2xl animate-pulse" />
            ) : (
              <MdSensorsOff className="text-2xl" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                Shake-to-SOS Detection
              </h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isShakeEnabled
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}
              >
                {isShakeEnabled ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Active (3x Shake)
                  </>
                ) : (
                  "Disabled"
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Shake device 3 times to automatically trigger the emergency SOS
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <label className="relative inline-flex items-center cursor-pointer self-start sm:self-center">
          <input
            type="checkbox"
            checked={isShakeEnabled}
            onChange={(e) => setIsShakeEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          <span className="ml-2.5 text-xs font-semibold text-gray-700 select-none">
            {isShakeEnabled ? "ON" : "OFF"}
          </span>
        </label>
      </div>

      {/* Permission alert for iOS Safari if required */}
      {permissionStatus === "prompt" && (
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2.5">
            <FaApple className="text-xl text-gray-900 shrink-0" />
            <p className="text-xs font-medium">
              iOS Safari requires sensor authorization to enable shake gestures.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGrantPermission}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-sm shrink-0"
          >
            Allow Motion Access
          </button>
        </div>
      )}

      {/* Shake Progress Bar (if in progress) */}
      {shakeCount > 0 && (
        <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MdVibration className="text-xl text-red-600 animate-bounce" />
            <span className="text-sm font-bold text-red-900">
              Shake registered: {shakeCount} of 3
            </span>
          </div>
          <button
            type="button"
            onClick={resetShakeCount}
            className="text-xs font-semibold text-gray-500 hover:text-red-700 underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Feature Details & How it Works */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            1
          </span>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Triple-Shake Gesture</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Shake 3 times firmly in 3.5s. Haptic vibration confirms each shake.
            </p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            2
          </span>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Auditory Confirmation</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Unique synthesized chirps and tones confirm gesture recognition.
            </p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            3
          </span>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Instant Dispatch</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Triggers the SOS button, gets GPS coords, and notifies contacts.
            </p>
          </div>
        </div>
      </div>

      {/* Settings & Interactive Simulator Tools */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Sensitivity Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <MdTune className="text-sm" />
            <span>Sensitivity:</span>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(["low", "medium", "high"] as SensitivityLevel[]).map((level) => {
              const isSelected = sensitivity === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSensitivity(level)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition ${
                    isSelected
                      ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {level === "medium" ? "Medium (Rec)" : level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Simulation / Testing Tools for Desktop & Testing */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-400">
            Testing Tools:
          </span>

          <button
            type="button"
            onClick={simulateShake}
            disabled={!isShakeEnabled}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <MdVibration className="text-sm text-red-500" />
            Simulate 1 Shake
          </button>

          <button
            type="button"
            onClick={handleSimulateTriple}
            disabled={!isShakeEnabled || isSimulatingTriple}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSimulatingTriple ? (
              <FiRefreshCw className="animate-spin text-sm" />
            ) : (
              <FiPlay className="text-xs" />
            )}
            Simulate 3x Shake (Trigger SOS)
          </button>
        </div>
      </div>

      <div className="mt-3 text-right">
        <span className="text-[11px] text-gray-400">
          💡 Keyboard shortcut: Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono">S</kbd> to test a shake gesture
        </span>
      </div>
    </section>
  );
}
