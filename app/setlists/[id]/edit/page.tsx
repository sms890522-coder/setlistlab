"use client";

import Link from "next/link";
import { SongLibraryPanel } from "@/components/SongLibraryPanel";
import { SongForm } from "@/components/SongForm";
import { cloneSong, createBlankSong } from "@/lib/factories";
import { deleteSongFromLibrary, getSetlist, getSongLibrary, saveSetlist } from "@/lib/storage";
import type { SavedSong, Setlist, Song } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetlistEditPage() {
  const params = useParams<{ id: string }>();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [library, setLibrary] = useState<SavedSong[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");

  useEffect(() => {
    setSetlist(getSetlist(params.id) ?? null);
    setLibrary(getSongLibrary());
    setLoaded(true);
  }, [params.id]);

  function persist(next: Setlist) {
    const saved = saveSetlist(next);
    setSetlist(saved);
    setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  function updateSetlist(patch: Partial<Setlist>) {
    if (!setlist) return;
    persist({ ...setlist, ...patch });
  }

  function updateSong(songId: string, nextSong: Song) {
    if (!setlist) return;
    persist({
      ...setlist,
      songs: setlist.songs.map((song) => (song.id === songId ? nextSong : song)),
    });
  }

  function moveSong(index: number, direction: -1 | 1) {
    if (!setlist) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= setlist.songs.length) return;
    const songs = [...setlist.songs];
    const [song] = songs.splice(index, 1);
    songs.splice(nextIndex, 0, song);
    persist({ ...setlist, songs });
  }

  function handleLibrarySaved(saved: SavedSong, overwritten: boolean) {
    setLibrary(getSongLibrary());
    setLibraryMessage(
      overwritten
        ? `${saved.song.title || "곡"}의 보관함 정보를 덮어썼습니다.`
        : `${saved.song.title || "곡"}을 보관함에 저장했습니다.`,
    );
  }

  function addFromLibrary(savedSong: SavedSong) {
    if (!setlist) return;
    persist({ ...setlist, songs: [...setlist.songs, cloneSong(savedSong.song)] });
    setLibraryMessage(`${savedSong.song.title || "곡"}을 콘티에 추가했습니다.`);
  }

  function deleteFromLibrary(id: string) {
    deleteSongFromLibrary(id);
    setLibrary(getSongLibrary());
    setLibraryMessage("곡을 보관함에서 삭제했습니다.");
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
          <h1 className="text-2xl font-black text-slate-950">수정할 콘티를 찾을 수 없습니다</h1>
          <Link href="/setlists" className="btn-primary mt-5">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">자동 저장 {savedAt ? `· ${savedAt}` : "대기 중"}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">콘티 수정</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">입력한 내용은 localStorage에 자동 저장됩니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/setlists/${setlist.id}`} className="btn-primary">
            콘티 보기
          </Link>
          <Link href="/setlists" className="btn-secondary">
            목록
          </Link>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">콘티 제목</span>
            <input
              value={setlist.title}
              onChange={(event) => updateSetlist({ title: event.target.value })}
              className="field-input"
              placeholder="2026년 6월 7일 주일예배 콘티"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">예배 날짜</span>
            <input
              value={setlist.worshipDate}
              onChange={(event) => updateSetlist({ worshipDate: event.target.value })}
              className="field-input"
              type="date"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">예배 이름</span>
            <input
              value={setlist.serviceName}
              onChange={(event) => updateSetlist({ serviceName: event.target.value })}
              className="field-input"
              placeholder="주일 2부예배"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">전체 설명</span>
            <textarea
              value={setlist.description ?? ""}
              onChange={(event) => updateSetlist({ description: event.target.value })}
              className="field-input min-h-24 resize-y"
              placeholder="오늘은 고백적인 흐름으로 진행합니다."
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">전체 강조사항</span>
            <textarea
              value={setlist.globalNotes ?? ""}
              onChange={(event) => updateSetlist({ globalNotes: event.target.value })}
              className="field-input min-h-28 resize-y"
              placeholder="곡 사이 전환, 다이내믹, 인도자 멘트 등을 적어주세요."
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">곡 목록</h2>
            <p className="field-help">곡을 추가하고 순서를 조정하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLibraryOpen((value) => !value)} className="btn-secondary">
              {libraryOpen ? "곡 보관함 닫기" : "보관함에서 불러오기"}
            </button>
            <button
              type="button"
              onClick={() => persist({ ...setlist, songs: [...setlist.songs, createBlankSong()] })}
              className="btn-primary"
            >
              새 곡 추가
            </button>
          </div>
        </div>

        {libraryOpen ? <SongLibraryPanel songs={library} onAdd={addFromLibrary} onDelete={deleteFromLibrary} /> : null}
        {libraryMessage ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{libraryMessage}</p>
        ) : null}

        {setlist.songs.length === 0 ? (
          <div className="card p-8 text-center">
            <h3 className="text-xl font-black text-slate-950">곡을 추가해 주세요</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              유튜브 링크, 구성, 파트별 메모를 한 곡씩 정리할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => persist({ ...setlist, songs: [...setlist.songs, createBlankSong()] })}
              className="btn-primary mt-5"
            >
              첫 곡 추가
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {setlist.songs.map((song, index) => (
              <SongForm
                key={song.id}
                song={song}
                index={index}
                onChange={(nextSong) => updateSong(song.id, nextSong)}
                onDelete={() => persist({ ...setlist, songs: setlist.songs.filter((item) => item.id !== song.id) })}
                onMoveUp={() => moveSong(index, -1)}
                onMoveDown={() => moveSong(index, 1)}
                onLibrarySaved={handleLibrarySaved}
                canMoveUp={index > 0}
                canMoveDown={index < setlist.songs.length - 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
