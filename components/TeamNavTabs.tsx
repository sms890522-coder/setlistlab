import Link from "next/link";

export type TeamNavTabKey = "dashboard" | "setlists" | "chat" | "direct" | "posts" | "calendar" | "members" | "settings";

export function TeamNavTabs({ teamId, active }: { teamId: string; active: TeamNavTabKey }) {
  const tabs = [
    { href: `/teams/${teamId}`, label: "대시보드", key: "dashboard" },
    { href: `/teams/${teamId}#team-setlists`, label: "콘티", key: "setlists" },
    { href: `/teams/${teamId}/chat`, label: "채팅", key: "chat" },
    { href: `/teams/${teamId}/direct`, label: "1:1", key: "direct" },
    { href: `/teams/${teamId}/posts`, label: "공지사항", key: "posts" },
    { href: `/teams/${teamId}/calendar`, label: "캘린더", key: "calendar" },
    { href: `/teams/${teamId}#team-members`, label: "팀원", key: "members" },
    { href: `/teams/${teamId}#team-settings`, label: "설정", key: "settings" },
  ] as const;

  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="팀 내부 메뉴">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? "shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm"
              : "shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
