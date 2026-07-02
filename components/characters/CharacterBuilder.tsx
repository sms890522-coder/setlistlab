"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CHARACTER_GENDERS,
  CHARACTER_INSTRUMENTS,
  DEFAULT_CHARACTER_CONFIG,
  getCharacterConfig,
  getCharacterGenderLabel,
  getCharacterInstrumentLabel,
  getCharacterPresetOptions,
  getCharacterPresetVariantLabel,
  getCharacterSummary,
  normalizeCharacterConfig,
  type CharacterConfig,
  type CharacterGender,
  type CharacterInstrument,
  type CharacterPresetVariant,
} from "@/lib/characters/characterPresets";
import { CharacterImage } from "./CharacterImage";

type CharacterBuilderProps = {
  enabled: boolean;
};

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

export function CharacterBuilder({ enabled }: CharacterBuilderProps) {
  const [character, setCharacter] = useState<CharacterConfig>(DEFAULT_CHARACTER_CONFIG);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasCharacter, setHasCharacter] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCharacter() {
      if (!enabled) return;
      setStatus("loading");
      setError("");

      try {
        const response = await fetchCharacter("GET");
        if (cancelled) return;
        setCharacter(normalizeCharacterConfig(response.config));
        setHasCharacter(Boolean(response.hasCharacter));
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

  function handleSaved(nextCharacter: CharacterConfig) {
    setCharacter(nextCharacter);
    setHasCharacter(true);
    setModalOpen(false);
    setStatus("saved");
    setMessage("캐릭터가 저장되었습니다.");
    setError("");
  }

  if (!enabled) return null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-violet-100 bg-violet-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">내 캐릭터</h2>
              <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-black text-violet-700">
                Admin 테스트 기능
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-violet-900">
              성별과 역할을 고른 뒤 완성형 캐릭터 스타일 4개 중 하나를 선택합니다. 프로필에서는 선택한 캐릭터 1개만 불러옵니다.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary min-h-10 px-4">
            {hasCharacter ? "캐릭터 변경" : "캐릭터 만들기"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr] sm:p-6">
        <div className="flex justify-center sm:justify-start">
          <CharacterImage character={character} alt={`${getCharacterSummary(character)} 캐릭터`} size="md" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500">{hasCharacter ? "현재 캐릭터" : "아직 선택한 캐릭터가 없습니다."}</p>
          <p className="mt-1 text-xl font-black text-slate-950">{hasCharacter ? getCharacterSummary(character) : "기본 캐릭터"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {hasCharacter ? "선택한 완성형 캐릭터 프리셋이 나중에 무대배치도에서 팀원 캐릭터로 사용됩니다." : "무대배치도에서 사용할 내 캐릭터를 만들어보세요."}
          </p>
          {status === "loading" ? <p className="mt-3 text-sm font-semibold text-slate-500">캐릭터를 불러오는 중입니다.</p> : null}
          {message ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </div>
      </div>

      {modalOpen ? <CharacterBuilderModal initialCharacter={character} onClose={() => setModalOpen(false)} onSaved={handleSaved} /> : null}
    </section>
  );
}

function CharacterBuilderModal({
  initialCharacter,
  onClose,
  onSaved,
}: {
  initialCharacter: CharacterConfig;
  onClose: () => void;
  onSaved: (character: CharacterConfig) => void;
}) {
  const [draft, setDraft] = useState<CharacterConfig>(() => normalizeCharacterConfig(initialCharacter));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const presetOptions = useMemo(() => getCharacterPresetOptions(draft), [draft.gender, draft.instrument]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave() {
    setStatus("saving");
    setError("");

    try {
      const response = await fetchCharacter("POST", { config: draft });
      onSaved(normalizeCharacterConfig(response.config));
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "캐릭터 저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  function handleReset() {
    setDraft(DEFAULT_CHARACTER_CONFIG);
    setError("");
    setStatus("idle");
  }

  function updateDraft(next: Partial<CharacterConfig>) {
    setDraft((current) => normalizeCharacterConfig({ ...current, ...next }));
    setError("");
    setStatus("idle");
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="character-builder-title">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-w-5xl sm:rounded-[2rem]">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-5 backdrop-blur sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="character-builder-title" className="text-xl font-black text-slate-950">
                내 캐릭터 만들기
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">성별과 역할을 선택한 뒤 원하는 캐릭터 스타일을 고르세요.</p>
            </div>
            <button type="button" onClick={onClose} className="btn-secondary min-h-10 px-3" aria-label="캐릭터 만들기 닫기">
              닫기
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-[300px_1fr] sm:p-6">
          <aside className="flex flex-col items-center gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm font-black text-slate-700">현재 미리보기</p>
            <CharacterImage character={draft} alt={`${getCharacterSummary(draft)} 캐릭터 미리보기`} size="lg" />
            <div className="w-full rounded-2xl bg-white p-4 text-center">
              <p className="font-black text-slate-950">{getCharacterSummary(draft)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">현재 조합의 캐릭터 스타일 4개 중 선택합니다.</p>
            </div>
          </aside>

          <div className="space-y-6">
            <OptionGroup title="성별">
              {CHARACTER_GENDERS.map((item) => (
                <CharacterOptionButton key={item.value} selected={draft.gender === item.value} onClick={() => updateDraft({ gender: item.value })}>
                  {item.label}
                </CharacterOptionButton>
              ))}
            </OptionGroup>

            <OptionGroup title="악기/역할">
              {CHARACTER_INSTRUMENTS.map((item) => (
                <CharacterOptionButton key={item.value} selected={draft.instrument === item.value} onClick={() => updateDraft({ instrument: item.value })}>
                  {item.label}
                </CharacterOptionButton>
              ))}
            </OptionGroup>

            <div>
              <p className="field-label">캐릭터 스타일</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {presetOptions.map((item) => (
                  <PresetOptionCard
                    key={item.value}
                    label={item.label}
                    description={item.description}
                    imageUrl={item.imageUrl}
                    selected={draft.presetVariant === item.value}
                    onClick={() => updateDraft({ presetVariant: item.value })}
                  />
                ))}
              </div>
            </div>

            <CharacterSelectionSummary character={draft} />

            <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-4 text-sm leading-6 text-violet-900">
              이 기능은 현재 Admin 테스트 기능입니다. 없는 조합을 억지로 합성하지 않고, 준비된 완성형 캐릭터 이미지만 보여줍니다.
            </div>

            {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end sm:p-6">
          <button type="button" onClick={handleReset} className="btn-secondary min-h-11 px-4">
            기본값으로
          </button>
          <button type="button" onClick={onClose} className="btn-secondary min-h-11 px-4">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={status === "saving"} className="btn-primary min-h-11 px-5">
            {status === "saving" ? "저장 중" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

function CharacterSelectionSummary({ character }: { character: CharacterConfig }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600 sm:grid-cols-3">
      <p>성별: {getCharacterGenderLabel(character.gender as CharacterGender)}</p>
      <p>역할: {getCharacterInstrumentLabel(character.instrument as CharacterInstrument)}</p>
      <p>스타일: {getCharacterPresetVariantLabel(character.presetVariant as CharacterPresetVariant)}</p>
    </div>
  );
}

function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="field-label">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function CharacterOptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3 py-2 text-sm font-bold transition ${
        selected ? "border-blue-500 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

function PresetOptionCard({
  label,
  description,
  imageUrl,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  imageUrl: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-3 text-left transition ${
        selected ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"
      }`}
    >
      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-rose-50">
        <img src={imageUrl} alt="" className="h-full w-full object-contain p-2" loading="lazy" draggable={false} />
      </span>
      <span className="mt-3 block text-sm font-black text-slate-950">{label}</span>
      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{description}</span>
    </button>
  );
}

type CharacterResponse = {
  config: CharacterConfig;
  hasCharacter?: boolean;
  updatedAt?: string | null;
};

async function fetchCharacter(method: "GET", body?: never): Promise<CharacterResponse>;
async function fetchCharacter(method: "POST", body: { config: CharacterConfig }): Promise<CharacterResponse>;
async function fetchCharacter(method: "GET" | "POST", body?: { config: CharacterConfig }) {
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
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as CharacterResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "캐릭터 요청에 실패했습니다.");
  return data;
}
