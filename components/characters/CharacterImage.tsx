"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CHARACTER_CONFIG,
  resolveCharacterImageUrl,
  type CharacterConfig,
} from "@/lib/characters/characterPresets";

type CharacterImageProps = {
  character?: CharacterConfig | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "size-16 rounded-2xl",
  md: "size-32 rounded-[1.75rem]",
  lg: "size-56 rounded-[2rem]",
};

export function CharacterImage({ character, alt, size = "lg", className = "" }: CharacterImageProps) {
  const selectedCharacter = character ?? DEFAULT_CHARACTER_CONFIG;
  const imageUrl = resolveCharacterImageUrl(selectedCharacter.gender, selectedCharacter.instrument, selectedCharacter.presetVariant);
  const fallbackComboUrl = resolveCharacterImageUrl(selectedCharacter.gender, selectedCharacter.instrument, "classic");
  const defaultImageUrl = resolveCharacterImageUrl(DEFAULT_CHARACTER_CONFIG.gender, DEFAULT_CHARACTER_CONFIG.instrument);
  const [currentSrc, setCurrentSrc] = useState(imageUrl);
  const [failedDefault, setFailedDefault] = useState(false);

  useEffect(() => {
    setCurrentSrc(imageUrl);
    setFailedDefault(false);
  }, [imageUrl]);

  return (
    <div
      className={`relative inline-flex ${SIZE_CLASSES[size]} items-center justify-center overflow-hidden border border-white/80 bg-gradient-to-br from-indigo-50 via-white to-rose-50 shadow-sm ${className}`}
      role="img"
      aria-label={alt}
    >
      {!failedDefault ? (
        <div className="relative h-full w-full">
          <img
            src={currentSrc}
            alt=""
            className="h-full w-full object-contain p-3"
            draggable={false}
            loading="lazy"
            onError={() => {
              if (currentSrc !== fallbackComboUrl) {
                setCurrentSrc(fallbackComboUrl);
                return;
              }
              if (currentSrc !== defaultImageUrl) {
                setCurrentSrc(defaultImageUrl);
                return;
              }
              setFailedDefault(true);
            }}
          />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-center">
          <span className={size === "sm" ? "text-2xl" : size === "md" ? "text-5xl" : "text-7xl"} aria-hidden="true">
            🙂
          </span>
          {size !== "sm" ? (
            <>
              <p className="text-sm font-black text-slate-800">내 캐릭터</p>
              <p className="text-xs font-semibold text-slate-500">이미지 준비 중</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
