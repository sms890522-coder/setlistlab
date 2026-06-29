"use client";

import { useEffect, useMemo, useState } from "react";
import { getAnnouncementList, markAnnouncementRead, type AnnouncementType, type AppAnnouncement } from "@/lib/announcements";
import { AnnouncementBadge, getAnnouncementTypeLabel } from "./AnnouncementBadge";
import { AnnouncementModal } from "./AnnouncementModal";

const TYPE_FILTERS: Array<{ value: AnnouncementType | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "feature", label: "새 기능" },
  { value: "improvement", label: "개선" },
  { value: "fix", label: "수정" },
  { value: "important", label: "중요" },
  { value: "maintenance", label: "점검" },
  { value: "tip", label: "팁" },
];

export function AnnouncementList() {
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [selected, setSelected] = useState<AppAnnouncement | null>(null);
  const [filter, setFilter] = useState<AnnouncementType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const { announcements: nextAnnouncements } = await getAnnouncementList();
        if (!cancelled) setAnnouncements(nextAnnouncements);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "새소식을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => announcements.filter((announcement) => filter === "all" || announcement.type === filter),
    [announcements, filter],
  );

  async function handleConfirm() {
    if (!selected) return;
    const id = selected.id;
    setAnnouncements((current) =>
      current.map((announcement) => (announcement.id === id ? { ...announcement, readAt: new Date().toISOString() } : announcement)),
    );
    setSelected(null);
    await markAnnouncementRead(id).catch(() => undefined);
  }

  if (loading) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">새소식을 불러오는 중입니다.</p>;
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>;
  }

  return (
    <>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${
              filter === item.value ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          새로운 새소식이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((announcement) => (
            <button
              key={announcement.id}
              type="button"
              onClick={() => setSelected(announcement)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AnnouncementBadge type={announcement.type} />
                <span className="text-xs font-black text-slate-400">{getAnnouncementTypeLabel(announcement.type)}</span>
                {announcement.readAt ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">확인함</span>
                ) : (
                  <span className="rounded-full bg-rose-600 px-2 py-1 text-[11px] font-black text-white">NEW</span>
                )}
                <span className="ml-auto text-xs font-bold text-slate-400">{formatDate(announcement.createdAt)}</span>
              </div>
              <h2 className="mt-3 text-lg font-black text-slate-950">{announcement.title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{announcement.summary}</p>
            </button>
          ))}
        </div>
      )}

      {selected ? <AnnouncementModal announcement={selected} onClose={() => setSelected(null)} onConfirm={handleConfirm} /> : null}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}
