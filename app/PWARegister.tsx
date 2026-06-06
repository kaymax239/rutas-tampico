"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    const limpiarCaches = async () => {
      if (!("caches" in window)) return;

      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    };

    void limpiarCaches();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch((error) =>
          console.log("Error registrando Service Worker", error)
        );
    }
  }, []);

  return null;
}
