"use client";

import { SetlistContinuousPlayer } from "@/components/SetlistContinuousPlayer";
import { getSetlist } from "@/lib/storage";
import type { Setlist } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetlistPlayPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSetlist(getSetlist(params.id) ?? null);
    setLoaded(true);
  }, [params.id]);

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">연속재생 콘티를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">콘티를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            같은 브라우저의 localStorage에 저장된 콘티만 연속재생할 수 있습니다.
          </p>
          <Link href="/setlists" className="btn-primary mt-5">
            콘티 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <SetlistContinuousPlayer setlist={setlist} />
    </div>
  );
}
