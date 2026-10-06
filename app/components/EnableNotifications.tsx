"use client";

import { useState } from "react";
import { requestNotificationPermission } from "@/lib/firebase-messaging";

export default function EnableNotifications() {
    const [status, setStatus] = useState("");

    async function enableNotifications() {
        setStatus("Requesting permission...");

        const token = await requestNotificationPermission();

        if (token) {
            setStatus("✅ Notifications enabled!");
            console.log("FCM Token:", token);
        } else {
            setStatus("❌ Notifications could not be enabled.");
        }
    }

    return (
        <div>
            <button onClick={enableNotifications}>
                🔔 Enable Emergency Notifications
            </button>

            {status && <p>{status}</p>}
        </div>
    );
}