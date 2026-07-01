"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CHARACTER_PRESETS,
  getCharacterCategoryLabel,
  getCharacterPresetById,
  getDefaultCharacterPreset,
  resolveCharacterPreset,
  type CharacterPreset,
  type CharacterPresetCategory,
} from "@/lib/characters/characterPresets";
import { CharacterPreview } from "./CharacterPreview";

type CharacterBuilderProps = {
  enabled: boolean;
};

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";
type CategoryFilter = CharacterPresetCategory | "all";

const CATEGORY_FILTERS: CategoryFilter[] = ["all", "vocal", "instrument", "leader", "casual"];

export function CharacterBuilder({ enabled }: CharacterBuilderProps) {
  const defaultPreset = getDefaultCharacterPreset();
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset.id);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPreset = getCharacterPresetById(selectedPresetId) ?? defaultPreset;
  const filteredPresets = useMemo(
    () => (category === "all" ? CHARACTER_PRESETS : CHARACTER_PRESETS.filter((preset) => preset.category === category)),
    [category],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCharacter() {
      if (!enabled) return;
      setStatus("loading");
      setError("");

      try {
        const response = await fetchCharacter("GET");
        if (cancelled) return;
        setSelectedPresetId(resolveCharacterPreset(response.presetId).id);
        setStatus("idle");
      } catch (loadError) {
        if (cancelled) return;
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "캐릭터를 불러오지 못했습니다.");
      }
    }

    void loadCharacter();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function handleSave() {
    setStatus("saving");
    setMessage("");
    setError("");

    try {
      const response = await fetchCharacter("POST", selectedPresetId);
      const savedPreset = resolveCharacterPreset(response.presetId);
      setSelectedPresetId(savedPreset.id);
      setStatus("saved");
      setMessage("캐릭터가 저장되었습니다.");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "캐릭터 저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  function handleReset() {
    if (!window.confirm("기본 캐릭터로 되돌릴까요? 저장하려면 저장 버튼을 눌러 주세요.")) return;
    setSelectedPresetId(defaultPreset.id);
    setCategory("all");
    setMessage("기본 캐릭터로 되돌렸습니다. 저장 버튼을 누르면 반영됩니다.");
    setError("");
    setStatus("idle");
  }

  function selectPreset(preset: CharacterPreset) {
    setSelectedPresetId(preset.id);
    setMessage("");
    if (status === "saved") setStatus("idle");
  }

  if (!enabled) return null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-violet-100 bg-violet-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">내 캐릭터 선택</h2>
              <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-black text-violet-700">
                Admin 테스트 기능
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-violet-900">
              나중에 무대배치도에서 사용할 내 캐릭터를 선택해보세요. 실제 캐릭터 이미지는 <span className="font-black">public/characters</span> 폴더에 넣으면 됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleReset} className="btn-secondary min-h-10 px-3">
              기본 캐릭터
            </button>
            <button type="button" onClick={handleSave} disabled={status === "saving" || status === "loading"} className="btn-primary min-h-10 px-4">
              {status === "saving" ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col items-center justify-start gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-sm font-black text-slate-700">현재 선택한 캐릭터</p>
          <CharacterPreview preset={selectedPreset} />
          <div className="w-full rounded-2xl bg-white p-4 text-center">
            <p className="font-black text-slate-950">{selectedPreset.name}</p>
            {selectedPreset.description ? <p className="mt-1 text-sm leading-6 text-slate-500">{selectedPreset.description}</p> : null}
            {selectedPreset.recommendedPart ? (
              <p className="mt-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                추천 파트: {selectedPreset.recommendedPart}
              </p>
            ) : null}
          </div>
          {status === "loading" ? <p className="text-sm font-semibold text-slate-500">캐릭터를 불러오는 중입니다.</p> : null}
          {message ? <p className="w-full rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="w-full rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </aside>

        <div className="space-y-5">
          <div>
            <p className="field-label">카테고리</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setCategory(filter)}
                  className={`min-h-10 rounded-full border px-3 py-2 text-sm font-bold transition ${
                    category === filter
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  {getCharacterCategoryLabel(filter)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredPresets.map((preset) => {
              const selected = preset.id === selectedPreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`group rounded-3xl border bg-white p-3 text-left shadow-sm transition ${
                    selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  <div className="flex justify-center">
                    <CharacterPreview preset={preset} size="md" className={selected ? "ring-2 ring-blue-300" : ""} />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-slate-950">{preset.name}</p>
                      {selected ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">선택됨</span> : null}
                    </div>
                    {preset.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{preset.description}</p> : null}
                    {preset.recommendedPart ? (
                      <p className="mt-2 w-fit rounded-full bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                        {preset.recommendedPart}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            실제 캐릭터 이미지가 아직 없으면 카드에 임시 placeholder가 표시됩니다. 같은 파일명으로 WebP/PNG 에셋을 추가하면 자동으로 이미지가 보입니다.
          </p>
        </div>
      </div>
    </section>
  );
}

async function fetchCharacter(method: "GET" | "POST", presetId?: string) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch("/api/profile/character", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify({ presetId }) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { presetId?: unknown; imageUrl?: unknown; error?: string };
  if (!response.ok) throw new Error(data.error || "캐릭터 요청에 실패했습니다.");
  return data;
}
