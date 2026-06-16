"use client";

import {
  getCurrentNotificationUserId,
  getNotifications,
  getSafeNotificationLink,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type AppNotification,
} from "@/lib/db/notifications";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const recentNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isSupabaseConfigured()) {
        setLoaded(true);
        return;
      }

      const currentUserId = await getCurrentNotificationUserId();
      if (!currentUserId) {
        setUserId(null);
        setLoaded(true);
        return;
      }

      setUserId(currentUserId);

      try {
        const [nextNotifications, nextUnreadCount] = await Promise.all([getNotifications(20), getUnreadNotificationCount()]);
        if (cancelled) return;
        setNotifications(nextNotifications);
        setUnreadCount(nextUnreadCount);
        setError("");
      } catch {
        if (cancelled) return;
        setNotifications([]);
        setUnreadCount(0);
        setError("알림을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    return subscribeNotifications(userId, (notification, event) => {
      setNotifications((current) => mergeNotification(current, notification));
      if (event === "INSERT" && !notification.readAt) setUnreadCount((current) => current + 1);
      void getUnreadNotificationCount()
        .then(setUnreadCount)
        .catch(() => undefined);
    });
  }, [userId]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    const currentPageNotifications = notifications.filter((notification) => {
      if (notification.readAt) return false;
      const link = getSafeNotificationLink(notification.linkUrl);
      return link === pathname;
    });

    if (currentPageNotifications.length === 0) return;

    currentPageNotifications.forEach((notification) => {
      void markNotificationRead(notification.id).catch(() => undefined);
    });
    setNotifications((current) =>
      current.map((notification) =>
        currentPageNotifications.some((item) => item.id === notification.id)
          ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
          : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - currentPageNotifications.length));
  }, [notifications, pathname]);

  if (!loaded || !userId) return null;

  async function handleNotificationClick(notification: AppNotification) {
    const link = getSafeNotificationLink(notification.linkUrl);

    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt } : item)));
      setUnreadCount((current) => Math.max(0, current - 1));
      await markNotificationRead(notification.id).catch(() => undefined);
    }

    setOpen(false);
    if (link) router.push(link);
  }

  async function handleMarkAllRead() {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
    setUnreadCount(0);
    await markAllNotificationsRead().catch(() => undefined);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        aria-label={`알림 ${unreadCount}개`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-4 text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[70] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 px-4 py-3">
            <div>
              <p className="text-sm font-black text-slate-950">알림</p>
              <p className="text-xs font-semibold text-slate-500">팀 채팅과 콘티 소식</p>
            </div>
            <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0} className="text-xs font-black text-blue-700 disabled:text-slate-400">
              모두 읽음
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto p-2">
            {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            {!error && recentNotifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                아직 새 알림이 없습니다.
              </div>
            ) : null}
            {recentNotifications.map((notification) => {
              const unread = !notification.readAt;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-xl p-3 text-left transition hover:bg-blue-50 ${
                    unread ? "bg-blue-50/70" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${unread ? "bg-blue-600" : "bg-slate-200"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-950">{notification.title}</span>
                      {notification.body ? (
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{notification.body}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] font-semibold text-slate-400">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mergeNotification(current: AppNotification[], notification: AppNotification) {
  const next = current.some((item) => item.id === notification.id)
    ? current.map((item) => (item.id === notification.id ? notification : item))
    : [notification, ...current];

  return next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20);
}

function formatNotificationTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
