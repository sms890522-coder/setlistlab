self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "콘티연습실";
  const url = payload.url || "/";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-72.png",
    data: { url },
    tag: payload.tag || url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const sameUrlClient = windowClients.find((client) => client.url === targetUrl);
      if (sameUrlClient) {
        return sameUrlClient.focus();
      }

      const sameOriginClient = windowClients.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOriginClient) {
        await sameOriginClient.focus();
        if ("navigate" in sameOriginClient) {
          return sameOriginClient.navigate(targetUrl);
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })(),
  );
});
