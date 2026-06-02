"use client";

import { createBlankSetlist } from "@/lib/factories";
import { saveSetlist } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewSetlistPage() {
  const router = useRouter();

  useEffect(() => {
    const setlist = saveSetlist(createBlankSetlist());
    router.replace(`/setlists/${setlist.id}/edit`);
  }, [router]);

  return (
    <div className="page-shell">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-black text-slate-950">새 콘티를 만드는 중입니다</h1>
        <p className="mt-2 text-sm text-slate-600">곧바로 수정 화면으로 이동합니다.</p>
      </div>
    </div>
  );
}
