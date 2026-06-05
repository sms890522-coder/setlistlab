"use client";

import Link from "next/link";
import { ExportImportPanel } from "@/components/ExportImportPanel";
import { SongCard } from "@/components/SongCard";
import { TeamAssignmentsView } from "@/components/TeamAssignmentsView";
import { duplicateSetlist, getPracticeCompletions, getSetlist, setPracticeCompletion } from "@/lib/storage";
import type { Setlist } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

export default function SetlistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [completedSongs, setCompletedSongs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSetlist(getSetlist(params.id) ?? null);
    setCompletedSongs(getPracticeCompletions(params.id));
    setLoaded(true);
  }, [params.id]);

  function toggleCompletion(songId: string, completed: boolean) {
    setPracticeCompletion(params.id, songId, completed);
    setCompletedSongs((current) => ({ ...current, [songId]: completed }));
  }

  function handleDuplicate() {
    const duplicated = duplicateSetlist(params.id);
    router.push(`/setlists/${duplicated.id}/edit`);
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">콘티를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">콘티를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 MVP는 서버 저장이 없어 다른 기기에서는 링크만으로 콘티를 열 수 없습니다. JSON 가져오기를 사용해 주세요.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/setlists" className="btn-secondary">
              목록으로
            </Link>
            <Link href="/import" className="btn-primary">
              JSON 가져오기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = setlist.songs.filter((song) => completedSongs[song.id]).length;

  return (
    <div className="page-shell space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-700">
                {setlist.worshipDate || "날짜 미정"} · {setlist.serviceName || "예배 이름 미정"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{setlist.title}</h1>
              {setlist.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">{setlist.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/setlists/${setlist.id}/play`} className="btn-primary">
                콘티 연속재생 시작
              </Link>
              <Link href={`/setlists/${setlist.id}/edit`} className="btn-secondary">
                수정
              </Link>
              <button type="button" onClick={handleDuplicate} className="btn-secondary">
                복제
              </button>
              <button type="button" onClick={() => router.refresh()} className="btn-secondary">
                새로고침
              </button>
            </div>
          </div>
        </div>

        {setlist.globalNotes ? (
          <div className="border-t border-slate-100 p-5 sm:p-7">
            <h2 className="font-bold text-slate-950">전체 강조사항</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{setlist.globalNotes}</p>
          </div>
        ) : null}
      </section>

      <TeamAssignmentsView assignments={setlist.teamAssignments} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">곡 목록</h2>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              연습 완료 {completedCount}/{setlist.songs.length}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {setlist.songs.length}곡
            </span>
          </div>
        </div>
        {setlist.songs.length === 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-xl font-black text-slate-950">아직 곡이 없습니다</h3>
            <p className="mt-2 text-sm text-slate-600">수정 화면에서 찬양곡을 추가해 주세요.</p>
            <Link href={`/setlists/${setlist.id}/edit`} className="btn-primary mt-5">
              곡 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {setlist.songs.map((song, index) => (
              <Fragment key={song.id}>
                <SongCard
                  song={song}
                  index={index}
                  href={`/setlists/${setlist.id}/songs/${song.id}`}
                  completed={Boolean(completedSongs[song.id])}
                  onCompletionChange={(completed) => toggleCompletion(song.id, completed)}
                />
                {song.transitionNote ? (
                  <div className="mx-3 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                    <p className="text-xs font-black text-violet-600">곡 뒤 멘트/기도</p>
                    <p className="mt-1 whitespace-pre-line">{song.transitionNote}</p>
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </section>

      <ExportImportPanel setlist={setlist} onImported={(imported) => router.push(`/setlists/${imported.id}`)} />
    </div>
  );
}
