"use client";

import { createBlankPartNote } from "@/lib/factories";
import { DEFAULT_PARTS, type PartNote } from "@/lib/types";

type PartNotesEditorProps = {
  partNotes: PartNote[];
  onChange: (partNotes: PartNote[]) => void;
};

export function PartNotesEditor({ partNotes, onChange }: PartNotesEditorProps) {
  function updateNote(id: string, patch: Partial<PartNote>) {
    onChange(partNotes.map((note) => (note.id === id ? { ...note, ...patch } : note)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-bold text-slate-950">파트별 메모</h4>
          <p className="field-help">팀원이 자기 파트만 빠르게 볼 수 있도록 정리하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...partNotes, createBlankPartNote()])}
          className="btn-secondary min-h-10 px-3"
        >
          메모 추가
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEFAULT_PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onChange([...partNotes, createBlankPartNote(part)])}
            className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            {part}
          </button>
        ))}
      </div>

      {partNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          아직 파트별 메모가 없습니다. 보컬, 일렉, 드럼 등 필요한 파트를 추가하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {partNotes.map((partNote) => (
            <div key={partNote.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[10rem_1fr_auto]">
              <label className="space-y-1">
                <span className="field-label">파트</span>
                <select
                  value={partNote.part}
                  onChange={(event) => updateNote(partNote.id, { part: event.target.value })}
                  className="field-input"
                >
                  {DEFAULT_PARTS.map((part) => (
                    <option key={part} value={part}>
                      {part}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">메모</span>
                <textarea
                  value={partNote.note}
                  onChange={(event) => updateNote(partNote.id, { note: event.target.value })}
                  className="field-input min-h-24 resize-y"
                  placeholder="예: 후렴 화음 주의"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => onChange(partNotes.filter((note) => note.id !== partNote.id))}
                  className="btn-danger min-h-10 px-3"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
