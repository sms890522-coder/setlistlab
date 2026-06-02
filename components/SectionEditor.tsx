"use client";

import { createBlankSection } from "@/lib/factories";
import { COMMON_SECTION_NAMES } from "@/lib/sections";
import type { SongSection } from "@/lib/types";
import { formatSecondsToTime, parseTimeToSeconds } from "@/lib/youtube";
import { useEffect, useState } from "react";

type SectionEditorProps = {
  sections: SongSection[];
  onChange: (sections: SongSection[]) => void;
};

export function SectionEditor({ sections, onChange }: SectionEditorProps) {
  function updateSection(id: string, patch: Partial<SongSection>) {
    onChange(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-950">곡 구성</h4>
          <p className="field-help">구간 이름과 반복 연습에 쓸 시작/종료 시간을 입력하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...sections, createBlankSection()])}
          className="btn-secondary min-h-10 px-3"
        >
          구간 추가
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {COMMON_SECTION_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange([...sections, { ...createBlankSection(), name }])}
            className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            {name}
          </button>
        ))}
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          아직 곡 구성이 없습니다. Intro, Verse, Chorus 같은 구간을 추가해 보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.8fr]">
                <label className="space-y-1">
                  <span className="field-label">구간 이름</span>
                  <input
                    value={section.name}
                    onChange={(event) => updateSection(section.id, { name: event.target.value })}
                    className="field-input"
                    placeholder="Intro"
                  />
                </label>
                <TimeInput
                  label="시작 시간"
                  value={section.startTime}
                  onChange={(value) => updateSection(section.id, { startTime: value })}
                />
                <TimeInput
                  label="종료 시간"
                  value={section.endTime}
                  onChange={(value) => updateSection(section.id, { endTime: value })}
                />
              </div>
              <label className="mt-3 block space-y-1">
                <span className="field-label">메모</span>
                <input
                  value={section.memo ?? ""}
                  onChange={(event) => updateSection(section.id, { memo: event.target.value })}
                  className="field-input"
                  placeholder="예: 일렉 딜레이 타이밍 주의"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  className="btn-secondary min-h-9 px-3"
                >
                  위로
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                  className="btn-secondary min-h-9 px-3"
                >
                  아래로
                </button>
                <button
                  type="button"
                  onClick={() => onChange(sections.filter((item) => item.id !== section.id))}
                  className="btn-danger min-h-9 px-3"
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

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}) {
  const [text, setText] = useState(formatSecondsToTime(value));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(formatSecondsToTime(value));
  }, [value]);

  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <input
        value={text}
        onChange={(event) => {
          const nextText = event.target.value;
          const parsed = parseTimeToSeconds(nextText);
          setText(nextText);
          setError("");
          if (!nextText.trim()) onChange(undefined);
          if (typeof parsed === "number") onChange(parsed);
        }}
        onBlur={() => {
          const parsed = parseTimeToSeconds(text);
          if (text.trim() && typeof parsed !== "number") {
            setError("00:18 또는 01:30 형식으로 입력해 주세요.");
            setText(formatSecondsToTime(value));
          }
        }}
        className="field-input"
        placeholder="00:18"
        inputMode="numeric"
      />
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}
