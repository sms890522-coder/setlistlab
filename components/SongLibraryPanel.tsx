"use client";

import type { SavedSong } from "@/lib/types";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SongLibraryPanelProps = {
  songs: SavedSong[];
  onAdd: (savedSong: SavedSong) => void;
  onDelete: (id: string) => void;
};

export function SongLibraryPanel({ songs, onAdd, onDelete }: SongLibraryPanelProps) {
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedSong | null>(null);
  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalizedQuery) return songs;
    return songs.filter((item) => item.song.title.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  }, [query, songs]);

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">곡 보관함</h3>
          <p className="field-help">저장해둔 곡 정보 전체를 현재 콘티에 불러옵니다.</p>
        </div>
        <label className="w-full sm:max-w-xs">
          <span className="sr-only">곡 보관함 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field-input"
            placeholder="곡 제목 검색"
          />
        </label>
      </div>

      {songs.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          아직 저장한 곡이 없습니다. 곡 입력 카드 아래의 보관함 저장 버튼을 눌러보세요.
        </div>
      ) : filteredSongs.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">검색 결과가 없습니다.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filteredSongs.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="font-black text-slate-950">{item.song.title || "제목 없는 곡"}</h4>
              <p className="mt-1 text-sm text-slate-500">
                연습키 {item.song.practiceKey || "-"} · BPM {item.song.bpm ?? "-"}
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                {item.song.sections.map((section) => section.name).filter(Boolean).join(" - ") || "곡 구성 없음"}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onAdd(item)} className="btn-primary min-h-10 flex-1 px-3">
                  불러오기
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="btn-danger min-h-10 px-3"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
              role="presentation"
              onClick={() => setDeleteTarget(null)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-saved-song-${deleteTarget.id}`}
                className="card w-full max-w-md p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-bold text-rose-600">보관함에서 삭제</p>
                <h3 id={`delete-saved-song-${deleteTarget.id}`} className="mt-2 text-xl font-black text-slate-950">
                  {deleteTarget.song.title || "제목 없는 곡"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  이 곡을 보관함에서 삭제할까요? 콘티에 이미 추가된 곡에는 영향을 주지 않습니다.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(deleteTarget.id);
                      setDeleteTarget(null);
                    }}
                    className="btn-danger"
                  >
                    삭제하기
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
