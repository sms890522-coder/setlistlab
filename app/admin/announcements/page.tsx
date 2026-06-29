import type { Metadata } from "next";
import { AnnouncementAdminClient } from "@/components/admin/AnnouncementAdminClient";

export const metadata: Metadata = {
  title: "새소식 관리 | 콘티연습실",
  description: "콘티연습실 새소식을 작성, 수정, 발행, 보관 처리하는 관리자 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAnnouncementsPage() {
  return (
    <div className="page-shell max-w-7xl">
      <section className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-black text-blue-200">Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">새소식 관리</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-200">
          앱 최상단에 표시할 새소식을 작성하고 발행 상태와 노출 기간을 관리합니다.
        </p>
      </section>
      <AnnouncementAdminClient />
    </div>
  );
}
