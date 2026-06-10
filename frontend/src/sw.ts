/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// Precache Vite-built static app assets (App shell)
precacheAndRoute(self.__WB_MANIFEST || []);

// 1. Caching App Shell static bundle files (HTML, JS, CSS)
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "document",
  new CacheFirst({
    cacheName: "app-shell-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// 2. Caching API GET requests (timetable, class roster, subject listings, etc.)
// Cache entries for 24 hours, returning stale data immediately while updating in the background.
registerRoute(
  ({ url }) =>
    url.pathname.includes("/api/v1/timetable") ||
    url.pathname.includes("/api/v1/classes") ||
    url.pathname.includes("/api/v1/students") ||
    url.pathname.includes("/api/v1/subjects") ||
    url.pathname.includes("/api/v1/scores"),
  new StaleWhileRevalidate({
    cacheName: "api-get-cache",
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 3. Caching Azure Blob storage assets & local uploads (student photos, report card PDFs)
// Cache for 7 days
registerRoute(
  ({ url }) =>
    url.hostname.includes("blob.core.windows.net") ||
    url.pathname.includes("/uploads/"),
  new CacheFirst({
    cacheName: "azure-blob-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 4. Intercept failed POST/PUT/PATCH/DELETE API requests and save to IndexedDB 'offline-queue'
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // We only intercept mutating HTTP requests targeting our local API endpoints
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
    url.pathname.includes("/api/v1/") &&
    !url.pathname.includes("/auth/login") &&
    !url.pathname.includes("/auth/refresh")
  ) {
    event.respondWith(
      fetch(request.clone()).catch(async (error) => {
        console.warn("[SW]: Network write request failed; intercepting and queueing offline.", error);

        // Read request payload text/json
        let body = null;
        try {
          body = await request.clone().json();
        } catch (e) {
          try {
            body = await request.clone().text();
          } catch (textErr) {}
        }

        // Store request in IndexedDB using native API (to avoid bundler scope errors in Service Worker context)
        try {
          await saveToOfflineQueue({
            url: request.url,
            method: request.method,
            body,
            timestamp: Date.now(),
            retries: 0,
          });

          // Return a successful response indicator so Axios/API caller is notified it was queued offline
          return new Response(
            JSON.stringify({
              success: true,
              queued: true,
              message: "Network offline. Request successfully queued for sync.",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (dbErr) {
          console.error("[SW]: Failed to write request payload to offline IndexedDB store", dbErr);
          // Fallback to forwarding the network error
          throw error;
        }
      })
    );
  }
});

// Helper function using standard raw IndexedDB transaction
function saveToOfflineQueue(data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("gradia-offline-db");
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      try {
        const transaction = db.transaction("offline-queue", "readwrite");
        const store = transaction.objectStore("offline-queue");
        const queueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        
        store.put({ id: queueId, ...data });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (err) {
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
