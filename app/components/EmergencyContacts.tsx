"use client";

import { FiPhoneCall } from "react-icons/fi";

const emergencyContacts = [
  {
    name: "Police Emergency",
    number: "112",
    icon: "🚔",
  },
  {
    name: "Police (Alternative)",
    number: "199",
    icon: "👮",
  },
  {
    name: "Ambulance",
    number: "112",
    icon: "🚑",
  },
  {
    name: "Fire Service",
    number: "112",
    icon: "🚒",
  },
  {
    name: "NEMA",
    number: "112",
    icon: "🆘",
  },
];

export default function EmergencyContacts() {
  const callNumber = (number: string) => {
    window.location.assign(`tel:${number}`);
  };

  return (
    <div className="w-full space-y-3">
      {emergencyContacts.map((contact, index) => (
        <div
          key={index}
          className="
            flex items-center justify-between
            rounded-xl
            border-2 border-red-200
            bg-red-50
            px-5 py-4
            transition-all
            hover:bg-red-100
          "
        >
          {/* Left section */}
          <div className="flex items-center gap-5">
            <span className="text-2xl">{contact.icon}</span>

            <div>
              <h3 className="font-semibold text-gray-900">{contact.name}</h3>

              <p className="text-sm text-gray-500">{contact.number}</p>
            </div>
          </div>

          {/* Call button */}
          <button
            onClick={() => callNumber(contact.number)}
            className="
              text-red-500
              hover:text-red-700
              transition
              cursor-pointer
            "
          >
            <FiPhoneCall size={24} />
          </button>
        </div>
      ))}
    </div>
  );
}
