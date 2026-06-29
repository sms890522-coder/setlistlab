import type { AnnouncementType } from "@/lib/announcements";

const TYPE_LABELS: Record<AnnouncementType, string> = {
  feature: "새 기능",
  improvement: "개선",
  fix: "수정",
  important: "중요",
  maintenance: "점검",
  tip: "팁",
};

const TYPE_CLASSES: Record<AnnouncementType, string> = {
  feature: "bg-blue-600 text-white",
  improvement: "bg-emerald-600 text-white",
  fix: "bg-amber-500 text-white",
  important: "bg-rose-600 text-white",
  maintenance: "bg-slate-800 text-white",
  tip: "bg-violet-600 text-white",
};

export function AnnouncementBadge({ type }: { type: AnnouncementType }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${TYPE_CLASSES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

export function getAnnouncementTypeLabel(type: AnnouncementType) {
  return TYPE_LABELS[type];
}
