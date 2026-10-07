importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyBN8x7lZF0XznbLAFH-dxtPH1a5dXBILl4",
    authDomain: "safealert-guardian.firebaseapp.com",
    projectId: "safealert-guardian",
    storageBucket: "safealert-guardian.firebasestorage.app",
    messagingSenderId: "443771481823",
    appId: "1:443771481823:web:28cdd34b94b5e9cf53836a",
    measurementId: "G-RKZP8NXB5Q",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log("[firebase-messaging-sw.js] Received background message", payload);
    const notificationTitle =
        payload.notification?.title || payload.data?.title || "🚨 SafeAlert Guardian";
    const notificationOptions = {
        body:
            payload.notification?.body ||
            payload.data?.body ||
            "Emergency alert or check-in update.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
        data: payload.data || {},
    };

    return self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === "/" && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow("/");
            }
        })
    );
});