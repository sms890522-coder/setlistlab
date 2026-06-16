"use client";

export type PushSupportStatus = "supported" | "unsupported" | "not_configured";

export function getPushSupportStatus(): PushSupportStatus {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "not_configured";
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }

  return "supported";
}

export async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("현재 브라우저에서는 서비스 워커를 지원하지 않습니다.");
  }

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function subscribeBrowserPush(registration: ServiceWorkerRegistration) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("푸시 알림 설정이 준비되지 않았습니다.");

  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) return existingSubscription;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function getBrowserPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
