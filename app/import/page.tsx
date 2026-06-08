"use client";

import Link from "next/link";
import { ExportImportPanel } from "@/components/ExportImportPanel";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const router = useRouter();

  return (
    <div className="page-shell space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">가져오기</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">백업 텍스트 가져오기</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            팀원이 공유한 콘티 백업 텍스트를 붙여넣으면 이 브라우저에 저장됩니다.
          </p>
        </div>
        <Link href="/setlists" className="btn-secondary">
          콘티 목록
        </Link>
      </section>

      <ExportImportPanel onImported={(setlist) => router.push(`/setlists/${setlist.id}`)} />
    </div>
  );
}
