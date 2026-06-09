"use client";

import { SetlistContinuousPlayer } from "@/components/SetlistContinuousPlayer";
import { getCurrentUser } from "@/lib/auth";
import { getCloudSetlist } from "@/lib/db/setlists";
import { getSetlist } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Setlist } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetlistPlayPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadError("");

    async function loadSetlist() {
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        if (user) {
          const cloudSetlist = await getCloudSetlist(params.id);
          if (cloudSetlist) {
            if (cloudSetlist.ownerId && cloudSetlist.ownerId !== user.id) {
              setLoadError("공유 받은 콘티의 원본 연속재생은 공유 링크에서 열어 주세요. 수정하려면 내 연습실로 복사하면 됩니다.");
            } else {
              setSetlist(cloudSetlist);
              setLoaded(true);
              return;
            }
          }
        }
      }

      setSetlist(getSetlist(params.id) ?? null);
      setLoaded(true);
    }

    loadSetlist().catch((error) => {
      setLoadError(error instanceof Error ? error.message : "연속재생 콘티를 불러오지 못했습니다.");
      setSetlist(getSetlist(params.id) ?? null);
      setLoaded(true);
    });
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
            {loadError || "콘티 목록에서 다시 열어 주세요."}
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
