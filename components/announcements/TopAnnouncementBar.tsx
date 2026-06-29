"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCurrentAnnouncement,
  hideAnnouncementToday,
  markAnnouncementRead,
  type AppAnnouncement,
} from "@/lib/announcements";
import { AnnouncementBadge } from "./AnnouncementBadge";
import { AnnouncementModal } from "./AnnouncementModal";

export function TopAnnouncementBar() {
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { announcement: nextAnnouncement } = await getCurrentAnnouncement();
        if (cancelled || !nextAnnouncement) return;
        if (isLocallyHidden(nextAnnouncement.id) || isLocallyRead(nextAnnouncement.id)) return;
        setAnnouncement(nextAnnouncement);
      } catch {
        // 새소식 로딩 실패는 앱 사용을 막지 않습니다.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  async function handleConfirm() {
    if (!announcement) return;
    setLocalRead(announcement.id);
    setAnnouncement(null);
    setModalOpen(false);
    await markAnnouncementRead(announcement.id).catch(() => undefined);
  }

  async function handleHideToday() {
    if (!announcement) return;
    setLocalHiddenToday(announcement.id);
    setAnnouncement(null);
    setModalOpen(false);
    await hideAnnouncementToday(announcement.id).catch(() => undefined);
  }

  return (
    <>
      <div className="border-b border-blue-100 bg-blue-950 text-white">
        <div className="mx-auto flex min-h-11 w-full max-w-6xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <AnnouncementBadge type={announcement.type} />
          <p className="min-w-0 flex-1 truncate text-sm font-bold">
            <span className="mr-2 text-blue-100">새소식</span>
            {announcement.summary}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-black text-white transition hover:bg-white/20"
          >
            자세히 보기
          </button>
          <button
            type="button"
            onClick={handleHideToday}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-base font-black transition hover:bg-white/20"
            aria-label="오늘만 숨기기"
            title="오늘만 숨기기"
          >
            ×
          </button>
          <Link href="/whats-new" className="hidden shrink-0 text-xs font-black text-blue-100 transition hover:text-white sm:inline">
            기록
          </Link>
        </div>
      </div>
      {modalOpen ? <AnnouncementModal announcement={announcement} onClose={() => setModalOpen(false)} onConfirm={handleConfirm} /> : null}
    </>
  );
}

function getHiddenKey(id: string) {
  return `setlistlab:announcement:hidden:${id}`;
}

function getReadKey(id: string) {
  return `setlistlab:announcement:read:${id}`;
}

function isLocallyHidden(id: string) {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(getHiddenKey(id));
  return value ? new Date(value).getTime() > Date.now() : false;
}

function isLocallyRead(id: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getReadKey(id)) === "true";
}

function setLocalHiddenToday(id: string) {
  if (typeof window === "undefined") return;
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  window.localStorage.setItem(getHiddenKey(id), tomorrow.toISOString());
}

function setLocalRead(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getReadKey(id), "true");
}
