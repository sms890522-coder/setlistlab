"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CHARACTER_CONFIG, getCharacterLayers, type CharacterConfig } from "@/lib/characters/characterPresets";

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
  const [failedLayers, setFailedLayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFailedLayers(new Set());
  }, [selectedCharacter]);

  const layers = getCharacterLayers(selectedCharacter);
  const hasFailedRequiredLayer = layers.some((layer) => layer.required && failedLayers.has(layer.key));

  return (
    <div
      className={`relative inline-flex ${SIZE_CLASSES[size]} items-center justify-center overflow-hidden border border-white/80 bg-gradient-to-br from-indigo-50 via-white to-rose-50 shadow-sm ${className}`}
      role="img"
      aria-label={alt}
    >
      {!hasFailedRequiredLayer ? (
        <div className="relative aspect-square h-full w-full">
          {layers.map((layer) =>
            failedLayers.has(layer.key) ? null : (
              <img
                key={layer.key}
                src={layer.src}
                alt=""
                className="absolute inset-0 h-full w-full object-contain p-2"
                draggable={false}
                loading="lazy"
                onError={() => {
                  setFailedLayers((previous) => {
                    const next = new Set(previous);
                    next.add(layer.key);
                    return next;
                  });
                }}
              />
            ),
          )}
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
