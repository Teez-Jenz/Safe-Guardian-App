"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp } from "./firebase";

export async function requestNotificationPermission() {
  try {
    // Check whether this browser supports Firebase Cloud Messaging
    const supported = await isSupported();

    if (!supported) {
      console.log("Firebase Cloud Messaging is not supported in this browser.");
      return null;
    }

    // Ask the user for notification permission
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission was not granted.");
      return null;
    }

    // Get Firebase Messaging instance
    const messaging = getMessaging(firebaseApp);

    // Get the browser's FCM registration token
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
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