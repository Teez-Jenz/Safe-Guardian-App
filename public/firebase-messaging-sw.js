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