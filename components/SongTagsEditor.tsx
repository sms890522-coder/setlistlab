"use client";

import { cleanTagName, normalizeTagName, RECOMMENDED_SONG_TAGS } from "@/lib/db/songTags";
import { useMemo, useState } from "react";

type SongTagsEditorProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  usedTags?: string[];
};

export function SongTagsEditor({ tags, onChange, usedTags = [] }: SongTagsEditorProps) {
  const [input, setInput] = useState("");
  const normalizedTags = useMemo(() => new Set(tags.map(normalizeTagName)), [tags]);
  const recommendations = useMemo(() => {
    const merged = [...RECOMMENDED_SONG_TAGS, ...usedTags];
    const seen = new Set<string>();
    return merged.filter((tag) => {
      const normalized = normalizeTagName(tag);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [usedTags]);
  const matches = useMemo(() => {
    const normalizedInput = normalizeTagName(input);
    if (!normalizedInput) return [];
    return recommendations
      .filter((tag) => normalizeTagName(tag).includes(normalizedInput) && !normalizedTags.has(normalizeTagName(tag)))
      .slice(0, 5);
  }, [input, normalizedTags, recommendations]);

  function addTag(value: string) {
    const cleaned = cleanTagName(value);
    if (!cleaned) return;
    if (cleaned.length > 30) return;

    const normalized = normalizeTagName(cleaned);
    if (normalizedTags.has(normalized)) {
      setInput("");
      return;
    }

    if (tags.length >= 20) return;
    onChange([...tags, cleaned]);
    setInput("");
  }

  function removeTag(tag: string) {
    const normalized = normalizeTagName(tag);
    onChange(tags.filter((item) => normalizeTagName(item) !== normalized));
  }

  function toggleTag(tag: string) {
    if (normalizedTags.has(normalizeTagName(tag))) {
      removeTag(tag);
      return;
    }
    addTag(tag);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
      <div>
        <h3 className="font-black text-slate-950">주제 태그</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          곡의 주제에 맞는 태그를 선택해 주세요. 나중에 태그별로 곡을 쉽게 찾을 수 있습니다.
        </p>
      </div>

      <div>
        <p className="field-label">선택된 태그</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="text-sm font-semibold text-slate-400">아직 선택한 태그가 없습니다.</p>
          ) : (
            tags.map((tag) => (
              <span key={normalizeTagName(tag)} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                #{tag}
                <button type="button" onClick={() => removeTag(tag)} className="rounded-full px-1 text-blue-500 hover:bg-blue-100 hover:text-blue-900" aria-label={`${tag} 태그 삭제`}>
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="field-label">직접 태그 추가</span>
        <input
          value={input}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) {
              value.split(",").forEach(addTag);
              return;
            }
            setInput(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(input);
            }
          }}
          className="field-input bg-white"
          placeholder="직접 태그 추가"
        />
      </label>

      {matches.length > 0 ? (
        <div>
          <p className="field-label">내 태그 추천</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {matches.map((tag) => (
              <button key={normalizeTagName(tag)} type="button" onClick={() => addTag(tag)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="field-label">추천 태그</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RECOMMENDED_SONG_TAGS.map((tag) => {
            const selected = normalizedTags.has(normalizeTagName(tag));
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-full bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm"
                    : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                }
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs font-semibold text-slate-500">곡마다 최대 20개, 태그 하나당 30자까지 저장됩니다.</p>
    </div>
  );
}
