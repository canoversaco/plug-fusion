import 'leaflet/dist/leaflet.css';

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";


const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw")
    .then((registration) => {
      console.log("Service Worker registriert:", registration);
      // Nutze registration für FCM etc.
    })
    .catch((err) => {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
    });
}
// auto-mount Chat FAB
