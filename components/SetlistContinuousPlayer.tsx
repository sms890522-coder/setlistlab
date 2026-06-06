"use client";

import type { Setlist, SongSection } from "@/lib/types";
import { formatSecondsToTime } from "@/lib/youtube";
import { getPracticePosition, setPracticePosition } from "@/lib/storage";
import { useYouTubeIframePlayer } from "@/hooks/useYouTubeIframePlayer";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

type PlayableSong = {
  song: Setlist["songs"][number];
  songIndex: number;
};

type SetlistContinuousPlayerProps = {
  setlist: Setlist;
  backHref?: string;
  backLabel?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
};

export function SetlistContinuousPlayer({
  setlist,
  backHref = `/setlists/${setlist.id}`,
  backLabel = "콘티 보기",
  emptyActionHref = `/setlists/${setlist.id}/edit`,
  emptyActionLabel = "유튜브 링크 입력하기",
}: SetlistContinuousPlayerProps) {
  const lastSavedPositionRef = useRef(0);

  const playableSongs = useMemo(
    () =>
      setlist.songs
        .map((song, songIndex) => ({ song, songIndex }))
        .filter((entry): entry is PlayableSong => Boolean(entry.song.youtubeVideoId)),
    [setlist.songs],
  );
  const [currentPlayableIndex, setCurrentPlayableIndex] = useState(0);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [notice, setNotice] = useState("");

  const currentEntry = playableSongs[currentPlayableIndex];
  const currentSong = currentEntry?.song;
  const selectedSection = currentSong?.sections.find((section) => section.id === selectedSectionId);
  const initialTime = useMemo(
    () => (currentSong ? getPracticePosition(setlist.id, currentSong.id) : 0),
    [currentSong?.id, setlist.id],
  );
  const player = useYouTubeIframePlayer({
    videoId: currentSong?.youtubeVideoId,
    autoplay: true,
    initialTime,
    onEnded: () => goToNext(true),
    onTimeUpdate: handleTimeUpdate,
    onTick: (nextTime, ytPlayer) => {
      if (
        loopEnabled &&
        selectedSection &&
        typeof selectedSection.startTime === "number" &&
        typeof selectedSection.endTime === "number" &&
        nextTime >= selectedSection.endTime
      ) {
        ytPlayer.seekTo(selectedSection.startTime, true);
      }
    },
  });

  useEffect(() => {
    if (currentPlayableIndex >= playableSongs.length && playableSongs.length > 0) {
      setCurrentPlayableIndex(playableSongs.length - 1);
    }
  }, [currentPlayableIndex, playableSongs.length]);

  useEffect(() => {
    setSelectedSectionId(currentSong?.sections[0]?.id ?? "");
    setLoopEnabled(false);
    setNotice("");
    lastSavedPositionRef.current = Math.round(initialTime);
  }, [currentSong?.id, initialTime]);

  function seekToSection(section: SongSection) {
    setSelectedSectionId(section.id);
    player.seekTo(section.startTime ?? 0);
  }

  function goToPrevious() {
    setNotice("");
    setCurrentPlayableIndex((current) => Math.max(0, current - 1));
  }

  function goToNext(fromEnded = false) {
    setCurrentPlayableIndex((current) => {
      if (current < playableSongs.length - 1) {
        return current + 1;
      }

      if (fromEnded) {
        setNotice("마지막 곡까지 재생했습니다.");
      }
      return current;
    });
  }

  function jumpToQueueSong(songId: string) {
    const nextIndex = playableSongs.findIndex((entry) => entry.song.id === songId);
    if (nextIndex < 0) return;
    setNotice("");
    setCurrentPlayableIndex(nextIndex);
  }

  function handleTimeUpdate(seconds: number) {
    if (!currentSong) return;
    if (Math.abs(seconds - lastSavedPositionRef.current) < 3) return;

    setPracticePosition(setlist.id, currentSong.id, seconds);
    lastSavedPositionRef.current = seconds;
  }

  if (playableSongs.length === 0) {
    return (
      <div className="space-y-6">
        <section className="card p-6 text-center">
          <p className="text-sm font-bold text-blue-700">{setlist.title}</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">재생 가능한 유튜브 링크가 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            곡 수정 화면에서 유튜브 링크를 입력하면 콘티 순서대로 연속재생할 수 있습니다.
          </p>
          <Link href={emptyActionHref} className="btn-primary mt-5">
            {emptyActionLabel}
          </Link>
        </section>
        <PlaylistQueue setlist={setlist} currentSongId="" onJump={jumpToQueueSong} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 lg:pb-20">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={backHref} className="text-sm font-bold text-blue-700">
              {setlist.title}
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">콘티 연속재생</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              유튜브 링크가 있는 곡을 콘티 순서대로 이어서 재생합니다.
            </p>
          </div>
          <Link href={backHref} className="btn-secondary w-fit">
            {backLabel}
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950">
          <div className="youtube-frame-host aspect-video w-full overflow-hidden rounded-lg" ref={player.hostRef} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 via-white to-violet-50 p-5">
          <p className="text-sm font-black text-blue-700">
            {currentEntry.songIndex + 1}/{setlist.songs.length}곡 · 현재 재생 중
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{currentSong.title || "제목 없는 곡"}</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">
            연습키 {currentSong.practiceKey || currentSong.originalKey || "-"} · BPM {currentSong.bpm ?? "-"}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            현재 {formatSecondsToTime(player.currentTime)} / {player.duration ? formatSecondsToTime(player.duration) : "--:--"}
          </p>
          {notice ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
          {player.error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{player.error}</p> : null}
        </div>

        <div className="border-t border-slate-100 p-5">
          <h3 className="font-bold text-slate-950">강조사항</h3>
          {currentSong.highlights.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">아직 강조사항이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {currentSong.highlights.map((highlight, index) => (
                <li key={`${highlight}-${index}`} className="rounded-lg bg-violet-50 p-3 text-sm leading-6 text-violet-800">
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">곡 구성 및 구간반복</h2>
            <p className="field-help">
              {selectedSection?.name ? `${selectedSection.name} 구간을 선택했습니다.` : "구간을 선택하면 해당 시간으로 이동합니다."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoopEnabled((value) => !value)}
            className={loopEnabled ? "btn-primary w-fit" : "btn-secondary w-fit"}
          >
            {loopEnabled ? "반복 ON" : "반복 OFF"}
          </button>
        </div>

        {currentSong.sections.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            아직 곡 구성 구간이 없습니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {currentSong.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => seekToSection(section)}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedSectionId === section.id
                    ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-950">{section.name || "구간"}</p>
                  <p className="text-xs font-bold text-blue-700">
                    {formatSecondsToTime(section.startTime)} - {formatSecondsToTime(section.endTime)}
                  </p>
                </div>
                {section.memo ? <p className="mt-2 text-sm leading-6 text-slate-600">{section.memo}</p> : null}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">재생속도</h2>
            <p className="field-help">YouTube IFrame API에서 지원하는 속도로 재생됩니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => player.changeSpeed(rate)}
                className={rate === player.speed ? "btn-primary min-h-10 px-3" : "btn-secondary min-h-10 px-3"}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
        {player.speedNotice ? <p className="mt-3 text-sm font-semibold text-amber-700">{player.speedNotice}</p> : null}
      </section>

      <PlaylistQueue setlist={setlist} currentSongId={currentSong.id} onJump={jumpToQueueSong} />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/75 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_35px_rgba(15,23,42,0.10)] backdrop-blur-md">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={goToPrevious}
              disabled={currentPlayableIndex === 0}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300/60 bg-white/55 px-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-white/75 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              이전 곡
            </button>
            <button
              type="button"
              onClick={player.togglePlayback}
              disabled={!player.ready}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-300/50 bg-blue-600/80 px-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700/90 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {player.playing ? "일시정지" : "재생"}
            </button>
            <button
              type="button"
              onClick={() => goToNext(false)}
              disabled={currentPlayableIndex >= playableSongs.length - 1}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300/60 bg-white/55 px-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-white/75 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              다음 곡
            </button>
          </div>
          <p className="mt-2 truncate text-center text-xs font-bold text-slate-600">
            {currentEntry.songIndex + 1}/{setlist.songs.length} · {currentSong.title || "제목 없는 곡"} ·{" "}
            {formatSecondsToTime(player.currentTime)}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlaylistQueue({
  setlist,
  currentSongId,
  onJump,
}: {
  setlist: Setlist;
  currentSongId: string;
  onJump: (songId: string) => void;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">곡 목록 큐</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{setlist.songs.length}곡</span>
      </div>

      {setlist.songs.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          아직 콘티에 곡이 없습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {setlist.songs.map((song, index) => {
            const active = song.id === currentSongId;
            const playable = Boolean(song.youtubeVideoId);
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => onJump(song.id)}
                disabled={!playable}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : playable
                      ? "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{song.title || "제목 없는 곡"}</p>
                    <p className={`mt-1 text-xs font-bold ${active ? "text-blue-100" : "text-slate-500"}`}>
                      연습키 {song.practiceKey || song.originalKey || "-"} · BPM {song.bpm ?? "-"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                      active
                        ? "bg-white/20 text-white"
                        : playable
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {active ? "재생 중" : playable ? "대기" : "링크 없음"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
