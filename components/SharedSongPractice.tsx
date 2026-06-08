"use client";

import Link from "next/link";
import { CapoTransposeHelper } from "@/components/CapoTransposeHelper";
import { SongImageGallery } from "@/components/SongImageGallery";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import type { Setlist } from "@/lib/types";
import { formatSecondsToTime } from "@/lib/youtube";
import { useRef } from "react";

type SharedSongPracticeProps = {
  setlist: Setlist;
  songId: string;
  backHref: string;
  songHref: (songId: string) => string;
};

export function SharedSongPractice({ setlist, songId, backHref, songHref }: SharedSongPracticeProps) {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const song = setlist.songs.find((item) => item.id === songId);

  if (!song) {
    return (
      <div className="page-shell">
        <section className="card p-8 text-center">
          <h1 className="text-2xl font-black text-slate-950">곡을 찾을 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">공유 콘티에 포함된 곡인지 확인해 주세요.</p>
          <Link href={backHref} className="btn-primary mt-5">
            곡 목록으로
          </Link>
        </section>
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
          <Link href={backHref} className="text-sm font-bold text-blue-700">
            {setlist.title}
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{song.title || "제목 없는 곡"}</h1>
          <p className="mt-2 text-sm text-slate-500">
            연습키 {song.practiceKey || "-"} · 원키 {song.originalKey || "-"} · BPM {song.bpm ?? "-"}
          </p>
        </div>
        <Link href={backHref} className="btn-secondary">
          곡 목록으로
        </Link>
      </section>

      {song.description ? (
        <section className="card p-5">
          <h2 className="font-bold text-slate-950">곡 설명</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{song.description}</p>
        </section>
      ) : null}

      {song.youtubeVideoId ? (
        <YouTubePlayer ref={playerRef} videoId={song.youtubeVideoId} sections={song.sections} />
      ) : (
        <section className="card p-6 text-center">
          <h2 className="text-xl font-black text-slate-950">유튜브 링크가 필요합니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 곡에는 아직 YouTube 링크가 없어 플레이어를 표시할 수 없습니다.
          </p>
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
                    <p className="font-bold text-slate-950">{section.name || "구간"}</p>
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

      {song.chordMemo || (song.sheetLinks?.length ?? 0) > 0 ? (
        <section className="card p-5">
          <h2 className="font-bold text-slate-950">코드 메모/악보 링크</h2>
          {song.chordMemo ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{song.chordMemo}</p>
          ) : null}
          {(song.sheetLinks?.length ?? 0) > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {song.sheetLinks
                ?.filter((link) => /^https?:\/\//i.test(link.url))
                .map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary min-h-10 px-3"
                  >
                    {link.label || "참고 링크"}
                  </a>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <SongImageGallery imageLinks={song.imageLinks} />

      <CapoTransposeHelper song={song} editable={false} />

      {song.transitionNote ? (
        <section className="rounded-lg border border-violet-100 bg-violet-50 p-5">
          <h2 className="font-bold text-violet-900">곡 뒤 멘트/기도</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-violet-800">{song.transitionNote}</p>
        </section>
      ) : null}

      <nav aria-label="곡 이동" className="card grid grid-cols-3 gap-2 p-3">
        {previousSong ? (
          <Link href={songHref(previousSong.id)} className="btn-secondary min-h-12 px-2 text-center" title={previousSong.title}>
            이전곡
          </Link>
        ) : (
          <button type="button" disabled className="btn-secondary min-h-12 px-2 text-center">
            이전곡
          </button>
        )}

        <Link href={backHref} className="btn-primary min-h-12 px-2 text-center">
          곡 목록
        </Link>

        {nextSong ? (
          <Link href={songHref(nextSong.id)} className="btn-secondary min-h-12 px-2 text-center" title={nextSong.title}>
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
