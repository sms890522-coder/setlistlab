"use client";

import {
  MUSIC_KEY_OPTIONS,
  getCapoSuggestions,
  normalizeKey,
  transposeChordProgression,
} from "@/lib/music";
import type { Song } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type CapoTransposeHelperProps = {
  song: Song;
  onChange?: (patch: Partial<Song>) => void;
  editable?: boolean;
};

export function CapoTransposeHelper({ song, onChange, editable = true }: CapoTransposeHelperProps) {
  const [targetKey, setTargetKey] = useState(song.practiceKey || song.originalKey || "C");
  const [detailOpen, setDetailOpen] = useState(false);
  const dialogTitleId = `capo-transpose-helper-${song.id}`;

  useEffect(() => {
    setTargetKey(song.practiceKey || song.originalKey || "C");
  }, [song.id, song.originalKey, song.practiceKey]);

  useEffect(() => {
    if (!detailOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailOpen]);

  const conversionResult = useMemo(() => {
    if (!song.chordProgression?.trim() || !song.originalKey || !targetKey) return "";
    return transposeChordProgression(song.chordProgression, song.originalKey, targetKey);
  }, [song.chordProgression, song.originalKey, targetKey]);

  const suggestions = getCapoSuggestions(targetKey || song.practiceKey || song.originalKey || "C");
  const summaryItems = [
    `원키 ${song.originalKey || "-"}`,
    `연습키 ${song.practiceKey || "-"}`,
    `${song.chordForm || "코드폼 미정"}폼`,
    `카포 ${typeof song.capo === "number" ? song.capo : "-"}`,
  ];

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-blue-100 bg-blue-50/60">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="block w-full p-4 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-950">카포/조옮김 도우미</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{summaryItems.join(" · ")}</p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1.5 text-sm font-black text-blue-700 shadow-sm">
              {editable ? "상세 수정" : "상세 보기"}
            </span>
          </div>
          {song.transposeMemo ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-blue-900">{song.transposeMemo}</p>
          ) : null}
        </button>
      </section>

      {detailOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-6"
              role="presentation"
              onClick={() => setDetailOpen(false)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-blue-100 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-blue-100 bg-white/95 p-4 backdrop-blur">
                  <div>
                    <p className="text-xs font-black text-blue-700">{song.title || "곡"}</p>
                    <h3 id={dialogTitleId} className="mt-1 text-xl font-black text-slate-950">
                      카포/조옮김 도우미
                    </h3>
                  </div>
                  <button type="button" onClick={() => setDetailOpen(false)} className="btn-secondary min-h-10 px-3">
                    닫기
                  </button>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KeySelect
                      label="원키"
                      value={song.originalKey ?? ""}
                      disabled={!editable}
                      onChange={(originalKey) => onChange?.({ originalKey })}
                    />
                    <KeySelect
                      label="연습키"
                      value={song.practiceKey ?? ""}
                      disabled={!editable}
                      onChange={(practiceKey) => {
                        onChange?.({ practiceKey });
                        setTargetKey(practiceKey);
                      }}
                    />
                    <label className="space-y-1">
                      <span className="field-label">코드폼</span>
                      <input
                        value={song.chordForm ?? ""}
                        onChange={(event) => onChange?.({ chordForm: event.target.value })}
                        className="field-input"
                        placeholder="G"
                        disabled={!editable}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="field-label">카포</span>
                      <input
                        value={song.capo ?? ""}
                        onChange={(event) => onChange?.({ capo: event.target.value ? Number(event.target.value) : undefined })}
                        className="field-input"
                        type="number"
                        min="0"
                        max="11"
                        disabled={!editable}
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="field-label">조옮김 메모</span>
                    <textarea
                      value={song.transposeMemo ?? ""}
                      onChange={(event) => onChange?.({ transposeMemo: event.target.value })}
                      className="field-input min-h-20 resize-y"
                      placeholder="여성 인도자 기준 G키로 낮춤"
                      disabled={!editable}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="field-label">코드 진행</span>
                    <textarea
                      value={song.chordProgression ?? ""}
                      onChange={(event) => onChange?.({ chordProgression: event.target.value })}
                      className="field-input min-h-24 resize-y font-mono"
                      placeholder={"G - D - Em - C\nEm - C - G - D"}
                      disabled={!editable}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <KeySelect label="변환할 목표키" value={targetKey} onChange={setTargetKey} />
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                      <p className="text-xs font-black text-blue-700">변환 결과</p>
                      <p className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-800">
                        {conversionResult || "원키와 코드 진행을 입력하면 변환 결과가 표시됩니다."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="font-bold text-slate-950">카포 추천</h5>
                      <span className="text-xs font-bold text-blue-700">실제 키 {normalizeKey(targetKey) || "-"}</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {suggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.chordForm}-${suggestion.capo}`}
                          className="rounded-lg border border-blue-100 bg-blue-50/40 p-4"
                        >
                          <p className="font-black text-slate-950">{suggestion.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            어쿠스틱 기타는 {suggestion.chordForm}폼 카포 {suggestion.capo}가 편할 수 있습니다.
                          </p>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() =>
                                onChange?.({
                                  practiceKey: targetKey,
                                  chordForm: suggestion.chordForm,
                                  capo: suggestion.capo,
                                })
                              }
                              className="btn-secondary mt-3 min-h-9 px-3"
                            >
                              추천값 적용
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      일렉은 실제 키 기준으로 연주하는 경우가 많으니 팀 상황에 맞게 선택하세요.
                    </p>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function KeySelect({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const hasCustomValue = value && !MUSIC_KEY_OPTIONS.includes(value as (typeof MUSIC_KEY_OPTIONS)[number]);

  return (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field-input" disabled={disabled}>
        <option value="">선택 안 함</option>
        {hasCustomValue ? <option value={value}>{value}</option> : null}
        {MUSIC_KEY_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
    </label>
  );
}
