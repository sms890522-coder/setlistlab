"use client";

import { SongLinksEditor } from "@/components/SongLinksEditor";
import type { Song } from "@/lib/types";

type ChordMemoEditorProps = {
  song: Song;
  onChange: (patch: Partial<Song>) => void;
};

export function ChordMemoEditor({ song, onChange }: ChordMemoEditorProps) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/70">
      <summary className="cursor-pointer list-none p-4 font-bold text-slate-950">코드 메모/악보 링크</summary>
      <div className="space-y-5 border-t border-slate-200 p-4">
        <label className="block space-y-1">
          <span className="field-label">코드 메모</span>
          <textarea
            value={song.chordMemo ?? ""}
            onChange={(event) => onChange({ chordMemo: event.target.value })}
            className="field-input min-h-28 resize-y"
            placeholder="이번 주 키, 코드 운지, 악기별 연주 방향을 적어주세요."
          />
        </label>
        <SongLinksEditor links={song.sheetLinks ?? []} onChange={(sheetLinks) => onChange({ sheetLinks })} />
      </div>
    </details>
  );
}
