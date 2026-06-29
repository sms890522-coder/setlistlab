import type { Metadata } from "next";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";

export const metadata: Metadata = {
  title: "새소식 | 콘티연습실",
  description: "콘티연습실의 새로운 기능, 개선사항, 수정사항과 중요한 안내를 확인하세요.",
};

export default function WhatsNewPage() {
  return (
    <div className="page-shell max-w-4xl">
      <section className="mb-6 rounded-3xl bg-gradient-to-br from-blue-600 to-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-black text-blue-100">SetlistLab Updates</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">새소식</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-blue-50">
          콘티연습실의 새 기능, 개선사항, 수정사항과 중요한 안내를 다시 확인할 수 있습니다.
        </p>
      </section>
      <AnnouncementList />
    </div>
  );
}
