"use client";

import React from "react";
import { useShake } from "../context/ShakeContext";
import { HiOutlineExclamationTriangle, HiXMark } from "react-icons/hi2";
import { MdSensors } from "react-icons/md";

export default function ShakeHud() {
  const { shakeCount, remainingWindowSec, resetShakeCount, isShaking } = useShake();

  if (shakeCount === 0) return null;

  // Percentage of time remaining in the 3.5s window
  const progressPercent = Math.min(100, Math.max(0, (remainingWindowSec / 3.5) * 100));

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div
        className={`rounded-2xl border-2 shadow-2xl backdrop-blur-md p-4 transition-all duration-200 ${
          shakeCount === 3
            ? "bg-red-600/95 border-red-300 text-white shadow-red-500/50 scale-105"
            : shakeCount === 2
            ? "bg-amber-950/95 border-red-500 text-white shadow-red-600/40"
            : "bg-gray-950/95 border-amber-500 text-white shadow-amber-500/30"
        } ${isShaking ? "animate-shake-urgent" : ""}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                shakeCount === 3
                  ? "bg-white text-red-600 animate-bounce"
                  : shakeCount === 2
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-amber-500 text-black animate-pulse"
              }`}
            >
              <MdSensors className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Motion Detected
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              </div>
              <h3 className="text-base font-extrabold leading-tight">
                {shakeCount === 3
                  ? "🚨 SOS BUTTON TRIGGERED!"
                  : `Shake ${shakeCount} of 3 Registered`}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={resetShakeCount}
            title="Cancel shake sequence"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <HiXMark className="text-xl" />
          </button>
        </div>

        {/* 3 Step Visual Indicators */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          {[1, 2, 3].map((step) => {
            const isCompleted = shakeCount >= step;
            const isCurrent = shakeCount === step;

            return (
              <div
                key={step}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all duration-200 ${
                  isCompleted
                    ? "bg-red-500 border-red-300 text-white font-black shadow-lg shadow-red-500/40"
                    : "bg-white/5 border-white/10 text-gray-400 font-semibold"
                } ${isCurrent ? "ring-2 ring-white scale-105" : ""}`}
              >
                <span className="text-xs">
                  {step === 3 ? "🆘" : step === 2 ? "⚡" : "👋"}
                </span>
                <span className="text-xs uppercase tracking-wide">
                  {step === 3 ? "SOS" : `Shake ${step}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subtext instruction & Countdown bar */}
        {shakeCount < 3 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5 font-medium">
              <span className="flex items-center gap-1 text-amber-300">
                <HiOutlineExclamationTriangle />
                Shake {3 - shakeCount} more time{3 - shakeCount > 1 ? "s" : ""} to activate SOS
              </span>
              <span className="font-mono text-gray-400">
                {remainingWindowSec.toFixed(1)}s
              </span>
            </div>

            {/* Time progress bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-red-500 h-full rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
