"use client";

import { useSafety } from "../context/SafetyContext";
import { HiOutlineExclamationCircle } from "react-icons/hi2";

export default function EmergencyBanner() {
  const { sosActive } = useSafety();

  if (!sosActive) return null;

  return (
    <div className="w-full bg-red-600 text-white py-3 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-md animate-pulse shrink-0">
      <HiOutlineExclamationCircle className="text-xl animate-spin" style={{ animationDuration: "3s" }} />
      <span>🚨 EMERGENCY SOS IS ACTIVE - CONTACTS ALERTED</span>
    </div>
  );
}
