"use client";

import { PartNotesEditor } from "@/components/PartNotesEditor";
import { SectionEditor } from "@/components/SectionEditor";
import type { Song } from "@/lib/types";
import { extractYouTubeVideoId } from "@/lib/youtube";

type SongFormProps = {
  song: Song;
  index: number;
  onChange: (song: Song) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function SongForm({
  song,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SongFormProps) {
  function updateSong(patch: Partial<Song>) {
    onChange({ ...song, ...patch });
  }

  return (
    <details className="card group overflow-hidden" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 bg-white/80 p-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-blue-700">곡 {index + 1}</p>
          <h3 className="truncate text-lg font-black text-slate-950">{song.title || "제목 없는 곡"}</h3>
        </div>
        <span className="text-sm font-semibold text-slate-500 group-open:hidden">열기</span>
        <span className="hidden text-sm font-semibold text-slate-500 group-open:inline">접기</span>
      </summary>

      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="field-label">곡 제목</span>
            <input
              value={song.title}
              onChange={(event) => updateSong({ title: event.target.value })}
              className="field-input"
              placeholder="나는 예배자입니다"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">유튜브 링크</span>
            <input
              value={song.youtubeUrl ?? ""}
              onChange={(event) => {
                const youtubeUrl = event.target.value;
                updateSong({ youtubeUrl, youtubeVideoId: extractYouTubeVideoId(youtubeUrl) });
              }}
              className="field-input"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="field-label">곡 설명</span>
            <textarea
              value={song.description ?? ""}
              onChange={(event) => updateSong({ description: event.target.value })}
              className="field-input min-h-24 resize-y"
              placeholder="곡 분위기, 인도 흐름, 참고할 점을 적어주세요."
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="field-label">원키</span>
            <input
              value={song.originalKey ?? ""}
              onChange={(event) => updateSong({ originalKey: event.target.value })}
              className="field-input"
              placeholder="F"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">연습키</span>
            <input
              value={song.practiceKey ?? ""}
              onChange={(event) => updateSong({ practiceKey: event.target.value })}
              className="field-input"
              placeholder="F"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">BPM</span>
            <input
              value={song.bpm ?? ""}
              onChange={(event) =>
                updateSong({
                  bpm: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className="field-input"
              type="number"
              min="1"
              placeholder="68"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="field-label">강조사항</span>
          <textarea
            value={song.highlights.join("\n")}
            onChange={(event) =>
              updateSong({
                highlights: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
            className="field-input min-h-28 resize-y"
            placeholder={"첫 곡이라 과하게 몰아가지 않기\n후렴 두 번째 반복부터 다이내믹 넓히기"}
          />
          <span className="field-help">한 줄에 하나씩 입력하면 보기 화면에서 요약됩니다.</span>
        </label>

        <SectionEditor sections={song.sections} onChange={(sections) => updateSong({ sections })} />
        <PartNotesEditor partNotes={song.partNotes} onChange={(partNotes) => updateSong({ partNotes })} />

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="btn-secondary min-h-10 px-3">
            위로
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="btn-secondary min-h-10 px-3">
            아래로
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("이 곡을 삭제할까요?")) onDelete();
            }}
            className="btn-danger min-h-10 px-3"
          >
            곡 삭제
          </button>
        </div>
      </div>
    </details>
  );
}
