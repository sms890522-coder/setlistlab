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
      <summary className="cursor-pointer list-none p-4 font-bold text-slate-950">코드 메모/악보/이미지</summary>
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
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
          <SongLinksEditor
            links={song.imageLinks ?? []}
            onChange={(imageLinks) => onChange({ imageLinks })}
            title="곡 이미지"
            addLabel="링크로 추가"
            emptyMessage="등록된 곡 이미지가 없습니다."
            labelPlaceholder="대표 이미지, 악보 이미지"
            urlPlaceholder="Google Drive, Dropbox, 이미지 링크"
            deleteMessage="곡 이미지 링크를 삭제할까요?"
            showPreview
            enableImageUpload
            uploadLabel="이미지 직접 넣기"
          />
          <p className="mt-3 text-xs leading-5 text-blue-800">
            이미지는 앱 서버가 아니라 별도 이미지 저장공간에 올리고, 곡에는 주소만 보관합니다. 직접 넣기와 링크 추가를
            함께 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </details>
  );
}
