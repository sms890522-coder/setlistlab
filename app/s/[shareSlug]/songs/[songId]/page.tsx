"use client";

import Link from "next/link";
import { SharedSongPractice } from "@/components/SharedSongPractice";
import { getPublicSetlistBySlug } from "@/lib/db/setlists";
import type { Setlist } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PublicSharedSongPage() {
  const params = useParams<{ shareSlug: string; songId: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadSetlist() {
      const sharedSetlist = await getPublicSetlistBySlug(params.shareSlug);
      if (!sharedSetlist) {
        setError("공개 공유 콘티를 찾을 수 없습니다.");
        setLoaded(true);
        return;
      }

      setSetlist(sharedSetlist);
      setLoaded(true);
    }

    loadSetlist().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "공유 곡을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [params.shareSlug]);

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">공유 곡을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (error || !setlist) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공유 곡을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-rose-700">{error || "공유 콘티가 없습니다."}</p>
          <Link href={`/s/${params.shareSlug}`} className="btn-primary mt-5">
            공유 콘티로 돌아가기
          </Link>
        </section>
      </div>
    );
  }

  return (
    <SharedSongPractice
      setlist={setlist}
      songId={params.songId}
      backHref={`/s/${params.shareSlug}`}
      songHref={(nextSongId) => `/s/${params.shareSlug}/songs/${nextSongId}`}
    />
  );
}
