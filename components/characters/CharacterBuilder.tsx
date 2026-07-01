"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CHARACTER_BACKGROUND_PALETTE,
  CHARACTER_FACE_SHAPES,
  CHARACTER_HAIR_COLORS,
  CHARACTER_HAIR_STYLES,
  CHARACTER_ITEMS,
  CHARACTER_COLOR_PALETTE,
  CHARACTER_EXPRESSIONS,
  CHARACTER_SKIN_TONES,
  CHARACTER_STYLES,
  getCharacterItemLabel,
  getDefaultCharacterConfig,
  normalizeCharacterConfig,
  type StageCharacterConfig,
} from "@/lib/characters/characterConfig";
import { CharacterPreview } from "./CharacterPreview";

type CharacterBuilderProps = {
  enabled: boolean;
};

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

const STYLE_LABELS: Record<StageCharacterConfig["style"], string> = {
  round: "둥근 캐릭터",
  soft: "소프트",
  simple: "심플",
};
const FACE_LABELS: Record<StageCharacterConfig["faceShape"], string> = {
  circle: "동그란 얼굴",
  oval: "타원형",
  square_round: "둥근 사각형",
};
const SKIN_LABELS: Record<StageCharacterConfig["skinTone"], string> = {
  light: "밝은 톤",
  medium: "중간 톤",
  warm: "따뜻한 톤",
  deep: "깊은 톤",
};
const HAIR_LABELS: Record<StageCharacterConfig["hairStyle"], string> = {
  short: "짧은 머리",
  medium: "중간 머리",
  long: "긴 머리",
  curly: "곱슬",
  cap: "모자",
  none: "없음",
};
const HAIR_COLOR_LABELS: Record<StageCharacterConfig["hairColor"], string> = {
  black: "블랙",
  brown: "브라운",
  dark_brown: "다크 브라운",
  blonde: "블론드",
};
const EXPRESSION_LABELS: Record<StageCharacterConfig["expression"], string> = {
  smile: "웃음",
  calm: "차분함",
  joy: "기쁨",
  focus: "집중",
};

export function CharacterBuilder({ enabled }: CharacterBuilderProps) {
  const [config, setConfig] = useState<StageCharacterConfig>(() => getDefaultCharacterConfig());
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
        setConfig(normalizeCharacterConfig(response.characterConfig));
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
      const response = await fetchCharacter("POST", config);
      setConfig(normalizeCharacterConfig(response.characterConfig));
      setStatus("saved");
      setMessage("캐릭터가 저장되었습니다.");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "캐릭터 저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  function handleReset() {
    if (!window.confirm("캐릭터를 기본값으로 되돌릴까요? 저장하려면 저장 버튼을 눌러 주세요.")) return;
    setConfig(getDefaultCharacterConfig());
    setMessage("기본값으로 되돌렸습니다. 저장 버튼을 누르면 반영됩니다.");
    setError("");
    setStatus("idle");
  }

  function updateConfig(next: Partial<StageCharacterConfig>) {
    setConfig((current) => normalizeCharacterConfig({ ...current, ...next }));
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
              <h2 className="section-title">캐릭터 만들기</h2>
              <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-black text-violet-700">
                Admin 테스트 기능
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-violet-900">
              무대배치도에서 사용할 내 캐릭터를 만들어보세요. 안정화 후 실험실 기능으로 제공될 예정입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleReset} className="btn-secondary min-h-10 px-3">
              기본값으로 초기화
            </button>
            <button type="button" onClick={handleSave} disabled={status === "saving" || status === "loading"} className="btn-primary min-h-10 px-4">
              {status === "saving" ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center justify-start gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <CharacterPreview config={config} />
          <div className="grid w-full grid-cols-2 gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-xl bg-white px-3 py-2">표정: {EXPRESSION_LABELS[config.expression]}</span>
            <span className="rounded-xl bg-white px-3 py-2">파트: {getCharacterItemLabel(config.item)}</span>
          </div>
          {status === "loading" ? <p className="text-sm font-semibold text-slate-500">캐릭터를 불러오는 중입니다.</p> : null}
          {message ? <p className="w-full rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
          {error ? <p className="w-full rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </div>

        <div className="grid gap-5">
          <OptionGroup title="스타일">
            {CHARACTER_STYLES.map((style) => (
              <OptionButton key={style} selected={config.style === style} onClick={() => updateConfig({ style })}>
                {STYLE_LABELS[style]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="얼굴형">
            {CHARACTER_FACE_SHAPES.map((faceShape) => (
              <OptionButton key={faceShape} selected={config.faceShape === faceShape} onClick={() => updateConfig({ faceShape })}>
                {FACE_LABELS[faceShape]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="피부톤">
            {CHARACTER_SKIN_TONES.map((skinTone) => (
              <OptionButton key={skinTone} selected={config.skinTone === skinTone} onClick={() => updateConfig({ skinTone })}>
                {SKIN_LABELS[skinTone]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="헤어스타일">
            {CHARACTER_HAIR_STYLES.map((hairStyle) => (
              <OptionButton key={hairStyle} selected={config.hairStyle === hairStyle} onClick={() => updateConfig({ hairStyle })}>
                {HAIR_LABELS[hairStyle]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="머리색">
            {CHARACTER_HAIR_COLORS.map((hairColor) => (
              <OptionButton key={hairColor} selected={config.hairColor === hairColor} onClick={() => updateConfig({ hairColor })}>
                {HAIR_COLOR_LABELS[hairColor]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="표정">
            {CHARACTER_EXPRESSIONS.map((expression) => (
              <OptionButton key={expression} selected={config.expression === expression} onClick={() => updateConfig({ expression })}>
                {EXPRESSION_LABELS[expression]}
              </OptionButton>
            ))}
          </OptionGroup>
          <OptionGroup title="파트 아이템">
            {CHARACTER_ITEMS.map((item) => (
              <OptionButton key={item} selected={config.item === item} onClick={() => updateConfig({ item })}>
                {getCharacterItemLabel(item)}
              </OptionButton>
            ))}
          </OptionGroup>
          <PaletteGroup title="상의 색상" value={config.topColor} colors={CHARACTER_COLOR_PALETTE} onChange={(topColor) => updateConfig({ topColor })} />
          <PaletteGroup title="하의 색상" value={config.bottomColor} colors={CHARACTER_COLOR_PALETTE} onChange={(bottomColor) => updateConfig({ bottomColor })} />
          <PaletteGroup
            title="배경색"
            value={config.backgroundColor ?? "#EEF2FF"}
            colors={CHARACTER_BACKGROUND_PALETTE}
            onChange={(backgroundColor) => updateConfig({ backgroundColor })}
          />
        </div>
      </div>
    </section>
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

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3 py-2 text-sm font-bold transition ${
        selected
          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

function PaletteGroup({
  title,
  value,
  colors,
  onChange,
}: {
  title: string;
  value: string;
  colors: readonly string[];
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <p className="field-label">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`size-10 rounded-full border-2 shadow-sm transition ${value.toUpperCase() === color.toUpperCase() ? "border-slate-950 ring-2 ring-blue-300" : "border-white"}`}
            style={{ backgroundColor: color }}
            aria-label={`${title} ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

async function fetchCharacter(method: "GET" | "POST", characterConfig?: StageCharacterConfig) {
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
    body: method === "POST" ? JSON.stringify({ characterConfig }) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { characterConfig?: unknown; error?: string };
  if (!response.ok) throw new Error(data.error || "캐릭터 요청에 실패했습니다.");
  return data;
}
