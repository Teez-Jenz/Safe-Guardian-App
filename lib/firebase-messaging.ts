"use client";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  MessagePayload,
} from "firebase/messaging";
import { firebaseApp } from "./firebase";

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.log("This browser does not support desktop notifications.");
      return null;
    }

    const supported = await isSupported();
    if (!supported) {
      console.log("Firebase Cloud Messaging is not supported in this browser.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission was not granted.");
      return null;
    }

    // Ensure the service worker is properly registered
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn("Service worker registration error:", swErr);
      }
    }

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log("No FCM registration token was generated.");
      return null;
    }

    console.log("FCM registration token:", token);
    return token;
  } catch (error) {
    console.error("Error setting up Firebase notifications:", error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  if (typeof window === "undefined") return () => {};
  try {
    const messaging = getMessaging(firebaseApp);
    return onMessage(messaging, callback);
  } catch (err) {
    console.warn("Could not listen for foreground messages:", err);
    return () => {};
  }
}