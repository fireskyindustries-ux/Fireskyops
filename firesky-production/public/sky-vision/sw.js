self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
  }
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}

  const title = data.title || "Sky Vision";
  const options = {
    body: data.body || "",
    icon: self.registration.scope + "favicon.svg",
    badge: self.registration.scope + "favicon.svg",
    data: { url: data.url || self.registration.scope },
    vibrate: [200, 100, 200],
    tag: data.tag || "sky-diary",
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

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
