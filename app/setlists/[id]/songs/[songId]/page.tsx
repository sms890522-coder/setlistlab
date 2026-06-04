"use client";

import Link from "next/link";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { getPracticeCompletion, getSetlist, saveSetlist, setPracticeCompletion } from "@/lib/storage";
import type { Setlist, Song, SongSection } from "@/lib/types";
import { formatSecondsToTime } from "@/lib/youtube";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SongPracticePage() {
  const params = useParams<{ id: string; songId: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [practiceCompleted, setPracticeCompletedState] = useState(false);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  useEffect(() => {
    const foundSetlist = getSetlist(params.id) ?? null;
    setSetlist(foundSetlist);
    setSong(foundSetlist?.songs.find((item) => item.id === params.songId) ?? null);
    setPracticeCompletedState(getPracticeCompletion(params.id, params.songId));
    setLoaded(true);
  }, [params.id, params.songId]);

  function handleSectionsChange(nextSections: SongSection[]) {
    if (!setlist || !song) return;

    const nextSong = { ...song, sections: nextSections };
    const savedSetlist = saveSetlist({
      ...setlist,
      songs: setlist.songs.map((item) => (item.id === song.id ? nextSong : item)),
    });
    const savedSong = savedSetlist.songs.find((item) => item.id === song.id) ?? nextSong;

    setSetlist(savedSetlist);
    setSong(savedSong);
  }

  function togglePracticeCompleted(completed: boolean) {
    setPracticeCompletion(params.id, params.songId, completed);
    setPracticeCompletedState(completed);
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-sm text-slate-500">곡을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!setlist || !song) {
    return (
      <div className="page-shell">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">곡을 찾을 수 없습니다</h1>
          <Link href="/setlists" className="btn-primary mt-5">
            콘티 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const currentSongIndex = setlist.songs.findIndex((item) => item.id === song.id);
  const previousSong = currentSongIndex > 0 ? setlist.songs[currentSongIndex - 1] : undefined;
  const nextSong =
    currentSongIndex >= 0 && currentSongIndex < setlist.songs.length - 1
      ? setlist.songs[currentSongIndex + 1]
      : undefined;

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/setlists/${setlist.id}`} className="text-sm font-bold text-blue-700">
            {setlist.title}
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{song.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            연습키 {song.practiceKey || "-"} · 원키 {song.originalKey || "-"} · BPM {song.bpm ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            <input
              type="checkbox"
              checked={practiceCompleted}
              onChange={(event) => togglePracticeCompleted(event.target.checked)}
              className="size-4 accent-emerald-600"
            />
            연습 완료
          </label>
          <Link href={`/setlists/${setlist.id}/edit`} className="btn-secondary">
            콘티 수정
          </Link>
        </div>
      </section>

      {song.description ? (
        <section className="card p-5">
          <h2 className="font-bold text-slate-950">곡 설명</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{song.description}</p>
        </section>
      ) : null}

      {song.youtubeVideoId ? (
        <YouTubePlayer
          ref={playerRef}
          videoId={song.youtubeVideoId}
          sections={song.sections}
          onSectionsChange={handleSectionsChange}
        />
      ) : (
        <section className="card p-6 text-center">
          <h2 className="text-xl font-black text-slate-950">유튜브 링크가 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            수정 화면에서 YouTube 링크를 입력하면 안전한 IFrame 플레이어로 연습할 수 있습니다.
          </p>
          <Link href={`/setlists/${setlist.id}/edit`} className="btn-primary mt-5">
            링크 입력하기
          </Link>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="card p-5">
          <h2 className="font-bold text-slate-950">곡 구성 및 구간이동</h2>
          {song.sections.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">아직 곡 구성 구간이 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {song.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => playerRef.current?.seekToSection(section)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold text-slate-950">{section.name}</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {formatSecondsToTime(section.startTime)} - {formatSecondsToTime(section.endTime)}
                    </p>
                  </div>
                  {section.memo ? <p className="mt-2 text-sm leading-6 text-slate-600">{section.memo}</p> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-bold text-slate-950">강조사항</h2>
            {song.highlights.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">아직 강조사항이 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {song.highlights.map((highlight, index) => (
                  <li key={`${highlight}-${index}`} className="rounded-xl bg-violet-50 p-3 text-sm leading-6 text-violet-800">
                    {highlight}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-bold text-slate-950">파트별 메모</h2>
            {song.partNotes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">아직 파트별 메모가 없습니다.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {song.partNotes.map((partNote) => (
                  <div key={partNote.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-blue-700">{partNote.part}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{partNote.note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {song.transitionNote ? (
        <section className="rounded-lg border border-violet-100 bg-violet-50 p-5">
          <h2 className="font-bold text-violet-900">곡 뒤 멘트/기도</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-violet-800">{song.transitionNote}</p>
        </section>
      ) : null}

      <nav aria-label="곡 이동" className="card grid grid-cols-3 gap-2 p-3">
        {previousSong ? (
          <Link
            href={`/setlists/${setlist.id}/songs/${previousSong.id}`}
            className="btn-secondary min-h-12 px-2 text-center"
            title={previousSong.title}
          >
            이전곡
          </Link>
        ) : (
          <button type="button" disabled className="btn-secondary min-h-12 px-2 text-center">
            이전곡
          </button>
        )}

        <Link href={`/setlists/${setlist.id}`} className="btn-primary min-h-12 px-2 text-center">
          곡 목록
        </Link>

        {nextSong ? (
          <Link
            href={`/setlists/${setlist.id}/songs/${nextSong.id}`}
            className="btn-secondary min-h-12 px-2 text-center"
            title={nextSong.title}
          >
            다음곡
          </Link>
        ) : (
          <button type="button" disabled className="btn-secondary min-h-12 px-2 text-center">
            다음곡
          </button>
        )}
      </nav>
    </div>
  );
}
