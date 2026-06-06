"use client";

import { cloneSong } from "@/lib/factories";
import { createId } from "@/lib/id";
import type { Setlist, Song, TeamAssignment } from "@/lib/types";
import { useMemo, useState } from "react";

type PreviousSetlistImportPanelProps = {
  setlists: Setlist[];
  onImportSongs: (songs: Song[]) => void;
  onImportTeamAssignments: (assignments: TeamAssignment[]) => void;
};

export function PreviousSetlistImportPanel({
  setlists,
  onImportSongs,
  onImportTeamAssignments,
}: PreviousSetlistImportPanelProps) {
  const [sourceId, setSourceId] = useState(setlists[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const sortedSetlists = useMemo(
    () => [...setlists].sort((a, b) => b.worshipDate.localeCompare(a.worshipDate) || b.updatedAt.localeCompare(a.updatedAt)),
    [setlists],
  );
  const selectedSetlist = sortedSetlists.find((item) => item.id === sourceId) ?? sortedSetlists[0];
  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    if (!selectedSetlist) return [];
    if (!normalizedQuery) return selectedSetlist.songs;

    return selectedSetlist.songs.filter((song) =>
      [song.title, song.description, song.practiceKey, song.originalKey, song.highlights.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery),
    );
  }, [query, selectedSetlist]);

  function importAllSongs() {
    if (!selectedSetlist || selectedSetlist.songs.length === 0) return;
    if (!window.confirm(`${selectedSetlist.title}의 곡 ${selectedSetlist.songs.length}개를 현재 콘티에 추가할까요?`)) return;
    onImportSongs(selectedSetlist.songs.map(cloneSong));
  }

  function importTeamAssignments() {
    if (!selectedSetlist || selectedSetlist.teamAssignments.length === 0) return;
    if (!window.confirm("현재 팀원 파트 배정을 지난 콘티의 배정표로 바꿀까요?")) return;
    onImportTeamAssignments(
      selectedSetlist.teamAssignments.map((assignment) => ({
        ...assignment,
        id: createId("assignment"),
      })),
    );
  }

  if (sortedSetlists.length === 0) {
    return (
      <section className="card p-5">
        <h3 className="font-bold text-slate-950">지난 콘티에서 불러오기</h3>
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          아직 불러올 지난 콘티가 없습니다. 콘티를 몇 번 사용하면 이전 곡과 팀원 배정을 빠르게 가져올 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">지난 콘티에서 불러오기</h3>
          <p className="field-help">이전 콘티의 곡이나 팀원 파트 배정을 현재 콘티에 재사용합니다.</p>
        </div>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
          {sortedSetlists.length}개 콘티
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <label className="space-y-1">
          <span className="field-label">불러올 콘티</span>
          <select
            value={selectedSetlist?.id ?? ""}
            onChange={(event) => setSourceId(event.target.value)}
            className="field-input"
          >
            {sortedSetlists.map((item) => (
              <option key={item.id} value={item.id}>
                {item.worshipDate || "날짜 미정"} · {item.title || "제목 없는 콘티"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="field-label">곡 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field-input"
            placeholder="제목, 키, 강조사항 검색"
          />
        </label>
      </div>

      {selectedSetlist ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importTeamAssignments}
              disabled={selectedSetlist.teamAssignments.length === 0}
              className="btn-secondary"
            >
              팀원 배정 복사
            </button>
            <button
              type="button"
              onClick={importAllSongs}
              disabled={selectedSetlist.songs.length === 0}
              className="btn-primary"
            >
              곡 전체 추가
            </button>
          </div>

          {filteredSongs.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">불러올 곡이 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {filteredSongs.map((song) => (
                <article key={song.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate font-black text-slate-950">{song.title || "제목 없는 곡"}</h4>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Key {song.practiceKey || song.originalKey || "-"} · BPM {song.bpm ?? "-"}
                      </p>
                    </div>
                    <button type="button" onClick={() => onImportSongs([cloneSong(song)])} className="btn-secondary min-h-9 px-3">
                      추가
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
