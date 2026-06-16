"use client";

import { getCurrentUser } from "@/lib/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/db/pushSubscriptions";
import {
  getBrowserPushSubscription,
  getPushSupportStatus,
  registerPushServiceWorker,
  subscribeBrowserPush,
  type PushSupportStatus,
} from "@/lib/push";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { AddToHomeScreenGuide } from "./AddToHomeScreenGuide";

type PermissionState = NotificationPermission | "unsupported" | "not_configured";

export function PushNotificationManager() {
  const [loaded, setLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [supportStatus, setSupportStatus] = useState<PushSupportStatus>("unsupported");
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const user = await getCurrentUser();
      const nextSupportStatus = getPushSupportStatus();

      if (cancelled) return;
      setIsLoggedIn(Boolean(user));
      setSupportStatus(nextSupportStatus);

      if (nextSupportStatus === "not_configured") {
        setPermission("not_configured");
        setLoaded(true);
        return;
      }

      if (nextSupportStatus === "unsupported") {
        setPermission("unsupported");
        setLoaded(true);
        return;
      }

      setPermission(Notification.permission);

      if (Notification.permission === "granted") {
        const registration = await registerPushServiceWorker().catch(() => null);
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(subscription));
      }

      if (!cancelled) setLoaded(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!isLoggedIn) throw new Error("로그인 후 휴대폰 알림을 켤 수 있습니다.");
      if (supportStatus === "not_configured") throw new Error("푸시 알림 설정이 준비되지 않았습니다.");
      if (supportStatus === "unsupported") throw new Error("현재 브라우저에서는 푸시 알림을 지원하지 않습니다.");

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        if (nextPermission === "denied") {
          throw new Error("브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해 주세요.");
        }
        setMessage("알림 권한 요청이 완료되지 않았습니다.");
        return;
      }

      const registration = await registerPushServiceWorker();
      const subscription = await subscribeBrowserPush(registration);
      await savePushSubscription(subscription);
      setSubscribed(true);
      setMessage("휴대폰 알림이 켜졌습니다.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "휴대폰 알림을 켜지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const subscription = await getBrowserPushSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      setMessage("휴대폰 알림 구독을 해제했습니다.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "휴대폰 알림 구독을 해제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTest() {
    setTesting(true);
    setError("");
    setMessage("");

    try {
      if (!isLoggedIn || !isSupabaseConfigured()) throw new Error("로그인 후 테스트 알림을 보낼 수 있습니다.");
      if (!subscribed) throw new Error("휴대폰 알림을 먼저 켜 주세요.");

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("로그인이 필요합니다.");

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; sent?: number };

      if (!response.ok) {
        throw new Error(result.error || "테스트 알림을 보내지 못했습니다.");
      }

      setMessage("테스트 알림을 보냈습니다. 잠금 화면이나 알림 센터를 확인해 주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "테스트 알림을 보내지 못했습니다.");
    } finally {
      setTesting(false);
    }
  }

  if (!loaded) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">알림 상태를 확인하는 중입니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Mobile Push</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">휴대폰 알림</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          팀 채팅이나 새 콘티가 올라오면 휴대폰으로 알림을 받을 수 있습니다. iPhone에서는 홈 화면에 추가한 뒤 알림
          허용이 필요할 수 있습니다.
        </p>
      </div>

      <AddToHomeScreenGuide />

      <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <p className="font-black text-slate-950">현재 상태</p>
        <p className="mt-1">{getPermissionMessage(permission, subscribed, isLoggedIn)}</p>
      </div>

      {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy || !isLoggedIn || permission === "denied" || permission === "unsupported" || permission === "not_configured"}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "처리 중..." : subscribed ? "휴대폰 알림 다시 연결" : "휴대폰 알림 켜기"}
        </button>
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy || !subscribed}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          알림 구독 해제
        </button>
        <button
          type="button"
          onClick={handleSendTest}
          disabled={busy || testing || !subscribed}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
        >
          {testing ? "테스트 전송 중..." : "테스트 알림 보내기"}
        </button>
      </div>
    </section>
  );
}

function getPermissionMessage(permission: PermissionState, subscribed: boolean, isLoggedIn: boolean) {
  if (!isLoggedIn) return "로그인 후 휴대폰 알림을 설정할 수 있습니다.";
  if (permission === "not_configured") return "푸시 알림 설정이 준비되지 않았습니다.";
  if (permission === "unsupported") return "현재 브라우저에서는 푸시 알림을 지원하지 않습니다.";
  if (permission === "denied") return "브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해 주세요.";
  if (permission === "granted" && subscribed) return "휴대폰 알림이 켜져 있습니다.";
  if (permission === "granted") return "알림 권한은 허용되어 있고, 구독 연결이 필요합니다.";
  return "팀 채팅과 새 콘티 알림을 휴대폰으로 받을 수 있습니다.";
}
