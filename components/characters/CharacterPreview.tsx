"use client";

import { useState } from "react";
import { getDefaultCharacterPreset, type CharacterPreset } from "@/lib/characters/characterPresets";

type CharacterPreviewProps = {
  preset?: CharacterPreset | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const CATEGORY_ICONS: Record<CharacterPreset["category"], string> = {
  vocal: "🎤",
  instrument: "🎸",
  leader: "🙌",
  casual: "🙂",
  etc: "✨",
};

export function CharacterPreview({ preset, size = "lg", className = "" }: CharacterPreviewProps) {
  const selectedPreset = preset ?? getDefaultCharacterPreset();
  const [failed, setFailed] = useState(false);
  const dimensions = size === "sm" ? "size-16" : size === "md" ? "size-32" : "size-56";

  return (
    <div
      className={`relative inline-flex ${dimensions} items-center justify-center overflow-hidden rounded-[2rem] border border-white/80 bg-gradient-to-br from-indigo-50 via-white to-rose-50 shadow-sm ${className}`}
      aria-label={`${selectedPreset.name} 캐릭터 미리보기`}
      role="img"
    >
      {!failed ? (
        <img
          src={selectedPreset.imageUrl}
          alt=""
          className="h-full w-full object-contain p-3"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-center">
          <span className={size === "sm" ? "text-2xl" : size === "md" ? "text-5xl" : "text-7xl"} aria-hidden="true">
            {CATEGORY_ICONS[selectedPreset.category]}
          </span>
          {size !== "sm" ? (
            <>
              <p className="text-sm font-black text-slate-800">{selectedPreset.name}</p>
              <p className="text-xs font-semibold text-slate-500">캐릭터 이미지 준비 중</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
