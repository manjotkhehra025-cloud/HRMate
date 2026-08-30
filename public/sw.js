const CACHE = "hrmate-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate" || url.pathname.startsWith("/_next/")) return;
});

self.addEventListener("push", (event) => {
  let data = { title: "HRMate", body: "", url: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {
    // ignore
  }

  const options = {
    body: data.body,
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.data?.url || data.url || "/dashboard" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
