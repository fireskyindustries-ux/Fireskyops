const CACHE = "firesky-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
  }
});

// Push notification received
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}

  const title = data.title || "Firesky Industries";
  const options = {
    body: data.body || "",
    icon: self.registration.scope + "icon-192.png",
    badge: self.registration.scope + "icon-192.png",
    data: { url: data.url || self.registration.scope },
    vibrate: [200, 100, 200],
    tag: data.url || "firesky",
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification clicked — focus the app and navigate
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url;

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          if (url) client.navigate(url);
          return;
        }
      }
      if (url && clients.openWindow) return clients.openWindow(url);
    })
  );
});
