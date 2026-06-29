"use client";

import type { AppAnnouncement } from "@/lib/announcements";
import { AnnouncementBadge } from "./AnnouncementBadge";

export function AnnouncementModal({
  announcement,
  onClose,
  onConfirm,
}: {
  announcement: AppAnnouncement;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AnnouncementBadge type={announcement.type} />
              <span className="text-xs font-black text-slate-400">새소식</span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{announcement.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{announcement.summary}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500">
            닫기
          </button>
        </div>

        <div className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700">
          {announcement.body}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {announcement.linkUrl ? (
            <a
              href={announcement.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-center"
            >
              {announcement.linkLabel || "자세히 보기"}
            </a>
          ) : (
            <span />
          )}
          <button type="button" onClick={onConfirm} className="btn-primary">
            확인했어요
          </button>
        </div>
      </section>
    </div>
  );
}
