"use client";

import Link from "next/link";
import { getSharedSetlist, isSupabaseConfigured } from "@/lib/supabase";
import { importSetlist, parseSetlistJson } from "@/lib/storage";
import type { Setlist } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SharedSetlistPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadSharedSetlist() {
      if (!isSupabaseConfigured()) {
        setError("Supabase 환경변수가 설정되지 않아 공유 콘티를 불러올 수 없습니다.");
        setLoaded(true);
        return;
      }

      try {
        const row = await getSharedSetlist(params.slug);
        setSetlist(parseSetlistJson(JSON.stringify(row.setlist)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "공유 콘티를 불러오지 못했습니다.");
      } finally {
        setLoaded(true);
      }
    }

    loadSharedSetlist();
  }, [params.slug]);

  function saveToThisBrowser() {
    if (!setlist) return;
    const imported = importSetlist(setlist);
    router.push(`/setlists/${imported.id}`);
  }

  return (
    <div className="page-shell space-y-6">
      {!loaded ? (
        <div className="card p-8 text-sm text-slate-500">공유 콘티를 불러오는 중입니다.</div>
      ) : error ? (
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">공유 콘티를 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-rose-700">{error}</p>
          <Link href="/" className="btn-primary mt-5">
            홈으로
          </Link>
        </section>
      ) : setlist ? (
        <>
          <section className="card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
              <p className="text-sm font-bold text-blue-700">
                {setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{setlist.title}</h1>
              {setlist.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">{setlist.description}</p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={saveToThisBrowser} className="btn-primary">
                  이 기기에 저장하고 열기
                </button>
                <Link href="/" className="btn-secondary">
                  홈으로
                </Link>
              </div>
            </div>
            {setlist.globalNotes ? (
              <div className="border-t border-slate-100 p-5 sm:p-7">
                <h2 className="font-bold text-slate-950">전체 강조사항</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{setlist.globalNotes}</p>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">곡 목록</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                {setlist.songs.length}곡
              </span>
            </div>
            <div className="grid gap-4">
              {setlist.songs.map((song, index) => (
                <article key={song.id} className="card p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-slate-950">{song.title || "제목 없는 곡"}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        연습키 {song.practiceKey || "-"} · BPM {song.bpm ?? "-"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {song.sections.map((section) => section.name).join(" - ") || "곡 구성이 없습니다."}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
